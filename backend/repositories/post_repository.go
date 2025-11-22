// repository/post_repository.go
package repositories

import (
	"database/sql"
	"log"
	"social/models"
)

type PostRepository struct {
	DB *sql.DB
}

func NewPostRepository(db *sql.DB) *PostRepository {
	return &PostRepository{DB: db}
}

// repository/post_repository.go
func (r *PostRepository) IsUserFollowing(authorID, followerID int) (bool, error) {
    var exists bool
    err := r.DB.QueryRow(`
        SELECT EXISTS(
            SELECT 1 FROM followers 
            WHERE followed_id = ? AND follower_id = ?
        )`, authorID, followerID).Scan(&exists)
    if err != nil {
        return false, err
    }
    return exists, nil
}

func (r *PostRepository) IsAccountPrivate(userID int) (bool, error) {
    var isPrivate bool
    err := r.DB.QueryRow(`
        SELECT is_private FROM users WHERE id = ?
    `, userID).Scan(&isPrivate)
    if err != nil {
        return false, err
    }
    return isPrivate, nil
}

func (r *PostRepository) GetPublicPostsByUserID(userID int) ([]models.PostFetch, error) {
    return r.getPostsByPrivacy(userID, "public")
}

func (r *PostRepository) GetFollowersPostsByUserID(userID int) ([]models.PostFetch, error) {
    return r.getPostsByPrivacy(userID, "followers")
}

// repository/post_repository.go
func (r *PostRepository) GetAllPostsByUserID(userID int) ([]models.PostFetch, error) {
    rows, err := r.DB.Query(`
        SELECT 
            p.id, p.author_id, p.content, p.image_url, 
            p.privacy, p.created_at, u.avatar as author_avatar
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.author_id = ?
        ORDER BY p.created_at DESC
    `, userID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var posts []models.PostFetch
    for rows.Next() {
        var post models.PostFetch
        err := rows.Scan(
            &post.ID, &post.AuthorID, &post.Content, 
            &post.ImageURL, &post.Privacy, &post.CreatedAt, &post.AuthorAvatar,
        )
        if err != nil {
            log.Println("❌ scan error:", err)
            continue
        }
        posts = append(posts, post)
    }
    return posts, nil
}

func (r *PostRepository) GetCustomPostsForUser(authorID, viewerID int) ([]models.PostFetch, error) {
    rows, err := r.DB.Query(`
        SELECT 
            p.id, p.author_id, p.content, p.image_url, 
            p.privacy, p.created_at, u.avatar as author_avatar
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.author_id = ? AND p.privacy = 'custom'
        AND p.id IN (
            SELECT post_id FROM post_permissions WHERE user_id = ?
        )
        ORDER BY p.created_at DESC
    `, authorID, viewerID)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var posts []models.PostFetch
    for rows.Next() {
        var post models.PostFetch
        err := rows.Scan(
            &post.ID, &post.AuthorID, &post.Content, 
            &post.ImageURL, &post.Privacy, &post.CreatedAt, &post.AuthorAvatar,
        )
        if err != nil {
            log.Println("❌ scan error:", err)
            continue
        }
        posts = append(posts, post)
    }
    return posts, nil
}

func (r *PostRepository) getPostsByPrivacy(userID int, privacy string) ([]models.PostFetch, error) {
    rows, err := r.DB.Query(`
        SELECT 
            p.id, p.author_id, p.content, p.image_url, 
            p.privacy, p.created_at, u.avatar as author_avatar
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.author_id = ? AND p.privacy = ?
        ORDER BY p.created_at DESC
    `, userID, privacy)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var posts []models.PostFetch
    for rows.Next() {
        var post models.PostFetch
        err := rows.Scan(
            &post.ID, &post.AuthorID, &post.Content, 
            &post.ImageURL, &post.Privacy, &post.CreatedAt, &post.AuthorAvatar,
        )
        if err != nil {
            log.Println("❌ scan error:", err)
            continue
        }
        posts = append(posts, post)
    }
    return posts, nil
}

func (r *PostRepository) CreatePost(post models.PostFetch, recipients []int) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO posts (author_id, content, image_url, privacy, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		post.AuthorID, post.Content, post.ImageURL, post.Privacy, post.CreatedAt,
	)
	if err != nil {
		return err
	}

	postID, err := res.LastInsertId()
	if err != nil {
		return err
	}

	if post.Privacy == "custom" {
		stmt, err := tx.Prepare(`
			INSERT INTO post_permissions (post_id, user_id) VALUES (?, ?)
		`)
		if err != nil {
			return err
		}
		defer stmt.Close()

		for _, rid := range recipients {
			_, err = stmt.Exec(postID, rid)
			if err != nil {
				log.Println("❌ insert recipient failed:", err)
				continue
			}
		}
	}

	return tx.Commit()
}

func (r *PostRepository) GetPostsForUser(userID int) ([]models.PostFetch, error) {
    rows, err := r.DB.Query(`
        SELECT 
            p.id, 
            p.author_id, 
            p.content, 
            p.image_url, 
            p.privacy, 
            p.created_at,
            u.avatar as author_avatar
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.privacy = 'public' OR p.author_id = ? OR p.id IN (
            SELECT post_id FROM post_permissions WHERE user_id = ?
        )
        ORDER BY p.created_at DESC
    `, userID, userID)

    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var posts []models.PostFetch
    for rows.Next() {
        var post models.PostFetch
        err := rows.Scan(
            &post.ID,
            &post.AuthorID,
            &post.Content,
            &post.ImageURL,
            &post.Privacy,
            &post.CreatedAt,
            &post.AuthorAvatar,
        )
        if err != nil {
            log.Println("❌ scan error:", err)
            continue
        }
        posts = append(posts, post)
    }
    return posts, nil
}

func (r *PostRepository) GetCommentsByPost(postID string) ([]models.CommentWithUser, error) {
	rows, err := r.DB.Query(`
		SELECT c.id, c.content, c.image, c.created_at,
		       u.first_name, u.last_name, u.avatar
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.post_id = ?
		ORDER BY c.created_at ASC
	`, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []models.CommentWithUser

	for rows.Next() {
		var c models.CommentWithUser
		if err := rows.Scan(&c.ID, &c.Content, &c.ImageURL, &c.CreatedAt, &c.Author.FirstName, &c.Author.LastName, &c.Author.Avatar); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, nil
}

func (r *PostRepository) InsertComment(postID string, userID int, content, image, createdAt string) error {
	_, err := r.DB.Exec(`
		INSERT INTO comments (post_id, user_id, content, image, created_at)
		VALUES (?, ?, ?, ?, ?)`,
		postID, userID, content, image, createdAt)
	return err
}
