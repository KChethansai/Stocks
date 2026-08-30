import { create } from 'zustand'
import axios from 'axios'

//base api url
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const getErrorMessage = (err, fallback) => {
  if (err.response?.data?.message === 'Cloudinary is not configured') {
    return 'Cloudinary keys are missing in Backend/.env'
  }
  return err.response?.data?.message || fallback
}

export const useAuth = create((set) => ({
  currentUser: null,
  isAuthenticated: false,
  loading: false,
  uploadProgress: 0,
  initializing: true,
  error: null,

  //register user action
  register: async (data) => {
    set({ loading: true, uploadProgress: 0, error: null })
    try {
      const profileImage = data.profileImage?.[0]
      const payload = profileImage ? new FormData() : data
      if (profileImage) {
        payload.append('username', data.username)
        payload.append('email', data.email)
        payload.append('password', data.password)
        payload.append('profileImage', profileImage)
      }

      //send register request
      const response = await axios.post(`${API_BASE}/user-api/register`, payload, {
        withCredentials: true,
        onUploadProgress: (event) => {
          if (!profileImage) return
          const progress = event.total ? Math.round((event.loaded * 100) / event.total) : 0
          set({ uploadProgress: progress })
        }
      })
      set({ loading: false, uploadProgress: 0, error: null })
      return { success: true, message: response.data.message }
    } catch (err) {
      const message = getErrorMessage(err, 'Registration failed')
      set({ loading: false, uploadProgress: 0, error: message })
      return { success: false, message }
    }
  },

  //login user action
  login: async (data) => {
    set({ loading: true, error: null })
    try {
      //send login request
      const response = await axios.post(`${API_BASE}/user-api/login`, data, {
        withCredentials: true
      })
      set({
        loading: false,
        error: null,
        isAuthenticated: true,
        currentUser: response.data.user,
        initializing: false
      })
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed'
      set({
        loading: false,
        error: message,
        isAuthenticated: false,
        currentUser: null,
        initializing: false
      })
      return { success: false, message }
    }
  },

  //login with Google action
  loginWithGoogle: async (credential) => {
    set({ loading: true, error: null })
    try {
      const response = await axios.post(`${API_BASE}/api/auth/google`, { credential }, {
        withCredentials: true
      })
      set({
        loading: false,
        error: null,
        isAuthenticated: true,
        currentUser: response.data.user,
        initializing: false
      })
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.message || 'Google authentication failed'
      set({
        loading: false,
        error: message,
        isAuthenticated: false,
        currentUser: null,
        initializing: false
      })
      return { success: false, message }
    }
  },

  //logout user action
  logout: async () => {
    set({ loading: true, error: null })
    try {
      //send logout request
      await axios.post(
        `${API_BASE}/user-api/logout`,
        {},
        { withCredentials: true }
      )
      set({
        loading: false,
        currentUser: null,
        isAuthenticated: false,
        initializing: false
      })
      return { success: true, message: 'Logged out successfully' }
    } catch (err) {
      const message = err.response?.data?.message || 'Logout failed'
      set({ loading: false, error: message })
      return { success: false, message }
    }
  },

  //fetch user profile action
  fetchProfile: async () => {
    set({ loading: true, error: null })
    try {
      //send profile request
      const response = await axios.get(`${API_BASE}/user-api/profile`, {
        withCredentials: true
      })
      set({
        loading: false,
        error: null,
        currentUser: response.data.user,
        isAuthenticated: true,
        initializing: false
      })
      return { success: true }
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to fetch profile'
      set({
        loading: false,
        error: message,
        currentUser: null,
        isAuthenticated: false,
        initializing: false
      })
      return { success: false, message }
    }
  },

  // Alias for initializeAuth
  initializeAuth: async () => {
    return useAuth.getState().fetchProfile()
  },

  //update profile action
  updateProfile: async (data) => {
    set({ loading: true, error: null })
    try {
      const response = await axios.put(`${API_BASE}/user-api/profile`, data, {
        withCredentials: true
      })
      set({
        loading: false,
        error: null,
        currentUser: response.data.user,
        isAuthenticated: true
      })
      return { success: true, message: response.data.message }
    } catch (err) {
      const message = err.response?.data?.message || 'Profile update failed'
      set({ loading: false, error: message })
      return { success: false, message }
    }
  },

  //update password action
  updatePassword: async (data) => {
    set({ loading: true, error: null })
    try {
      const response = await axios.put(`${API_BASE}/user-api/password`, data, {
        withCredentials: true
      })
      set({ loading: false, error: null })
      return { success: true, message: response.data.message }
    } catch (err) {
      const message = err.response?.data?.message || 'Password update failed'
      set({ loading: false, error: message })
      return { success: false, message }
    }
  },

  //upload profile picture action
  uploadProfilePicture: async (file) => {
    set({ loading: true, uploadProgress: 0, error: null })
    try {
      const formData = new FormData()
      formData.append('profileImage', file)
      const response = await axios.post(`${API_BASE}/user-api/profile-picture`, formData, {
        withCredentials: true,
        onUploadProgress: (event) => {
          const progress = event.total ? Math.round((event.loaded * 100) / event.total) : 0
          set({ uploadProgress: progress })
        }
      })
      set((state) => ({
        loading: false,
        uploadProgress: 100,
        error: null,
        currentUser: state.currentUser
          ? { ...state.currentUser, profileImage: response.data.profileImage }
          : state.currentUser
      }))
      return { success: true, message: response.data.message }
    } catch (err) {
      const message = getErrorMessage(err, 'Profile picture upload failed')
      set({ loading: false, uploadProgress: 0, error: message })
      return { success: false, message }
    }
  },

  //fetch profile picture action
  fetchProfilePicture: async () => {
    try {
      const response = await axios.get(`${API_BASE}/user-api/profile-picture`, {
        withCredentials: true
      })
      set((state) => ({
        currentUser: state.currentUser
          ? { ...state.currentUser, profileImage: response.data.profileImage }
          : state.currentUser
      }))
      return { success: true, profileImage: response.data.profileImage }
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to fetch profile picture'
      return { success: false, message }
    }
  },

  removeProfilePicture: async () => {
    set({ loading: true, error: null })
    try {
      const response = await axios.delete(`${API_BASE}/user-api/profile-picture`, {
        withCredentials: true
      })
      set((state) => ({
        loading: false,
        uploadProgress: 0,
        error: null,
        currentUser: state.currentUser
          ? { ...state.currentUser, profileImage: response.data.profileImage }
          : state.currentUser
      }))
      return { success: true, message: response.data.message }
    } catch (err) {
      const message = err.response?.data?.message || 'Profile picture removal failed'
      set({ loading: false, error: message })
      return { success: false, message }
    }
  },

  // add to watchlist
  addToWatchlist: async (symbol) => {
    try {
      const response = await axios.post(`${API_BASE}/user-api/watchlist`, { symbol }, {
        withCredentials: true
      })
      set((state) => ({
        currentUser: state.currentUser
          ? { ...state.currentUser, watchlist: response.data.watchlist }
          : state.currentUser
      }))
      return { success: true, message: response.data.message }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to add to watchlist' }
    }
  },

  // remove from watchlist
  removeFromWatchlist: async (symbol) => {
    try {
      const response = await axios.delete(`${API_BASE}/user-api/watchlist/${symbol}`, {
        withCredentials: true
      })
      set((state) => ({
        currentUser: state.currentUser
          ? { ...state.currentUser, watchlist: response.data.watchlist }
          : state.currentUser
      }))
      return { success: true, message: response.data.message }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to remove from watchlist' }
    }
  },

  // patch balance in-place after a trade — avoids a full profile re-fetch
  patchBalance: (balance) =>
    set((state) => ({
      currentUser: state.currentUser
        ? { ...state.currentUser, balance }
        : state.currentUser
    }))
}))
