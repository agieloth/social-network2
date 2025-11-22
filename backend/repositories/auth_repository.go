package repositories

import (
	"database/sql"
	"errors"
	"social/models"
)

type SqliteUserRepo struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *SqliteUserRepo {
	return &SqliteUserRepo{db: db}
}

func (r *SqliteUserRepo) FindUserWithPasswordByEmail(email string) (*models.User, string, error) {
	var user models.User
	var hashedPassword string

	query := `SELECT id, password, email, first_name, last_name, date_of_birth, nickname, about, avatar FROM users WHERE email = ?`
	err := r.db.QueryRow(query, email).Scan(
		&user.ID, &hashedPassword,
		&user.Email, &user.FirstName, &user.LastName,
		&user.DateOfBirth, &user.Nickname, &user.About, &user.Avatar,
	)
	if err != nil {
		return nil, "", errors.New("user not found")
	}
	return &user, hashedPassword, nil
}

// repository/user_repository.go
func (r *SqliteUserRepo) CreateUser(user *models.User) error {
	query := `
	INSERT INTO users (email, password, first_name, last_name, date_of_birth, nickname, about, avatar)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query,
		user.Email,
		user.Password,
		user.FirstName,
		user.LastName,
		user.DateOfBirth,
		user.Nickname,
		user.About,
		user.Avatar,
	)
	return err
}

