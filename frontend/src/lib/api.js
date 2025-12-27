/**
 * API Client centralisé pour communiquer avec le backend
 * Élimine la duplication des appels fetch et centralise la configuration
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

class ApiClient {
  /**
   * Requête HTTP générique
   */
  async request(endpoint, options = {}) {
    const config = {
      credentials: 'include', // Pour les cookies de session
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      
      // Si c'est une 401, l'utilisateur n'est pas authentifié
      if (response.status === 401) {
        // Rediriger vers login si nécessaire (silencieusement)
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
          window.location.href = '/login';
        }
        // Ne pas throw d'erreur visible, juste rejeter la promesse
        return Promise.reject({ status: 401, message: 'Unauthorized' });
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP Error ${response.status}`);
      }

      // Si la réponse est vide (204 No Content), retourner null
      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      // Ne pas logger les erreurs 401 (unauthorized)
      if (error?.status !== 401) {
        console.error(`API Error [${endpoint}]:`, error);
      }
      throw error;
    }
  }

  // Méthodes HTTP de base
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data)
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Upload de fichiers
  upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData
    });
  }
}

// Instance unique du client API
export const api = new ApiClient();

// ==================== AUTH API ====================
export const authApi = {
  login: (email, password) => api.post('/api/login', { email, password }),
  register: (formData) => api.upload('/api/register', formData),
  logout: () => api.post('/api/logout', {}),
  getProfile: () => api.get('/api/profile'),
  getMe: () => api.get('/api/auth/me'),
};

// ==================== POSTS API ====================
export const postsApi = {
  getAll: () => api.get('/api/posts'),
  getUserPosts: (userId) => api.get(`/api/user-posts/${userId}`),
  create: (formData) => api.upload('/api/posts', formData),
  addComment: (formData) => api.upload('/api/comments', formData),
  getComments: (postId) => api.get(`/api/comments/post?id=${postId}`),
};

// ==================== USERS API ====================
export const usersApi = {
  search: (query) => api.get(`/api/search?query=${encodeURIComponent(query)}`),
  getById: (userId) => api.get(`/api/users/${userId}`),
  togglePrivacy: (isPrivate) => api.post('/api/user/toggle-privacy', { is_private: isPrivate }),
  getRecipients: () => api.get('/api/recipients'),
};

// ==================== FOLLOW API ====================
export const followApi = {
  send: (followedId) => api.post('/api/follow', { followed_id: followedId }),
  getStatus: (followedId) => api.get(`/api/follow/status/${followedId}`),
  accept: (senderId) => api.post('/api/follow/accept', { sender_id: senderId }),
  reject: (senderId) => api.post('/api/follow/reject', { sender_id: senderId }),
  unfollow: (followedId) => api.post('/api/unfollow', { followed_id: followedId }),
  getFollowers: (userId) => api.get(`/api/users-followers/${userId}`),
  getFollowing: (userId) => api.get(`/api/users-following/${userId}`),
};

// ==================== GROUPS API ====================
export const groupsApi = {
  getAll: () => api.get('/api/groups'),
  getById: (groupId) => api.get(`/api/groups/${groupId}`),
  create: (title, description) => api.post('/api/groups', { title, description }),
  
  // Members
  getMembers: (groupId) => api.get(`/api/groups/${groupId}/members`),
  checkMembership: (groupId) => api.get(`/api/groups/${groupId}/membership`),
  getPendingRequests: (groupId) => api.get(`/api/groups/${groupId}/membership/pending_requests`),
  join: (groupId) => api.post(`/api/groups/${groupId}/membership/join`, {}),
  acceptInvite: (groupId) => api.post(`/api/groups/${groupId}/membership/accept`, {}),
  refuseInvite: (groupId) => api.post(`/api/groups/${groupId}/membership/refuse`, {}),
  invite: (groupId, userId) => api.post(`/api/groups/${groupId}/invite`, { user_id: userId }),
  approveRequest: (groupId, userId) => api.post(`/api/groups/${groupId}/membership/approve`, { user_id: userId }),
  declineRequest: (groupId, userId) => api.post(`/api/groups/${groupId}/membership/decline`, { user_id: userId }),
  getInvitableMembers: (groupId) => api.get(`/api/groups/${groupId}/invitable_members`),
  
 // Posts
getPosts: (groupId) => api.get(`/api/groups/${groupId}/posts`),
createPost: (groupId, formData) => api.upload(`/api/groups/${groupId}/posts`, formData),
getComments: (groupId, postId) => api.get(`/api/groups/${groupId}/posts/${postId}/comments?post_id=${postId}`),
createComment: (groupId, postId, formData) => api.upload(`/api/groups/${groupId}/posts/${postId}/comments`, formData),
  
  // Events
  getEvents: (groupId) => api.get(`/api/groups/${groupId}/events`),
  createEvent: (groupId, eventData) => api.post(`/api/groups/${groupId}/events`, eventData),
  vote: (groupId, eventId, response) => api.post(`/api/groups/${groupId}/events/${eventId}/vote`, { response }),
  
  // Chat
  getChatHistory: (groupId, limit = 50) => api.get(`/api/groups/${groupId}/chat?limit=${limit}`),
  sendMessage: (groupId, content) => api.post(`/api/groups/${groupId}/messages`, { content }),
};

// ==================== CHAT API ====================
export const chatApi = {
  getUsers: () => api.get('/api/chat-users'),
  getHistory: (userId) => api.get(`/api/chat/history?with=${userId}`),
};

// ==================== NOTIFICATIONS API ====================
export const notificationsApi = {
  getAll: () => api.get('/api/notifications'),
  markSeen: (notificationId, markAll = false) => 
    api.post('/api/notifications/seen', { notification_id: notificationId, mark_all: markAll }),
  delete: (notificationId) => 
    api.post('/api/notifications/delete', { notification_id: notificationId }),
};

export default api;