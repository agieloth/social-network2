import { useState, useEffect, useCallback } from 'react';
import { postsApi } from '@/lib/api';
import toast from 'react-hot-toast';

/**
 * Hook personnalisé pour gérer les posts
 * Remplace la logique dupliquée dans HomePage et autres composants
 */
export function usePosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Récupère tous les posts
   */
  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await postsApi.getAll();
      setPosts(data || []);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setError(err.message);
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Récupère les posts d'un utilisateur spécifique
   */
  const fetchUserPosts = useCallback(async (userId) => {
    try {
      setLoading(true);
      setError(null);
      const data = await postsApi.getUserPosts(userId);
      setPosts(data || []);
    } catch (err) {
      console.error('Failed to fetch user posts:', err);
      setError(err.message);
      toast.error('Failed to load user posts');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Crée un nouveau post
   */
  const createPost = useCallback(async (content, image, privacy, recipientIds = []) => {
    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('privacy', privacy);
      
      if (image) {
        formData.append('image', image);
      }
      
      if (privacy === 'custom' && recipientIds.length > 0) {
        recipientIds.forEach(id => formData.append('recipient_ids', id));
      }

      await postsApi.create(formData);
      toast.success('Post created successfully!');
      
      // Rafraîchir la liste des posts
      await fetchPosts();
      
      return true;
    } catch (err) {
      console.error('Failed to create post:', err);
      toast.error(err.message || 'Failed to create post');
      return false;
    }
  }, [fetchPosts]);

  /**
   * Ajoute un post à la liste (pour les mises à jour temps réel)
   */
  const addPost = useCallback((newPost) => {
    setPosts(prev => [newPost, ...prev]);
  }, []);

  /**
   * Supprime un post de la liste
   */
  const removePost = useCallback((postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  /**
   * Met à jour un post dans la liste
   */
  const updatePost = useCallback((postId, updates) => {
    setPosts(prev => prev.map(p => 
      p.id === postId ? { ...p, ...updates } : p
    ));
  }, []);

  // Charger les posts au montage du composant
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return {
    posts,
    loading,
    error,
    fetchPosts,
    fetchUserPosts,
    createPost,
    addPost,
    removePost,
    updatePost
  };
}

export default usePosts;