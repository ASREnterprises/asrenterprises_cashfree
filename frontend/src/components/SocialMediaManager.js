import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart3, Plus, Calendar, CheckCircle, XCircle, Clock, Settings,
  Facebook, Instagram, Image, Video, Send, RefreshCw, Trash2, Edit,
  AlertTriangle, Link, Eye, Upload, X, FileText
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Platform Icons
const PlatformIcon = ({ platform, className = "w-5 h-5" }) => {
  if (platform === 'facebook') return <Facebook className={`${className} text-blue-600`} />;
  if (platform === 'instagram') return <Instagram className={`${className} text-pink-500`} />;
  return null;
};

// Status Badge Component
const StatusBadge = ({ status }) => {
  const config = {
    published: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
    scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Clock className="w-3 h-3" /> },
    failed: { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="w-3 h-3" /> },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: <Clock className="w-3 h-3" /> }
  };
  
  const c = config[status] || config.pending;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// Connection Status Badge
const ConnectionBadge = ({ connected, label }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${connected ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
    <span className={`text-sm font-medium ${connected ? 'text-green-700' : 'text-red-700'}`}>
      {label}: {connected ? 'Connected' : 'Not Connected'}
    </span>
  </div>
);

// Dashboard Tab
const DashboardTab = ({ stats, onRefresh, loading }) => (
  <div className="space-y-6">
    {/* Stats Cards */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
        <div className="text-3xl font-bold">{stats.total_posts || 0}</div>
        <div className="text-blue-100 text-sm">Total Posts</div>
      </div>
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
        <div className="text-3xl font-bold">{stats.scheduled_posts || 0}</div>
        <div className="text-purple-100 text-sm">Scheduled</div>
      </div>
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-5 text-white">
        <div className="text-3xl font-bold">{stats.published_posts || 0}</div>
        <div className="text-green-100 text-sm">Published</div>
      </div>
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white">
        <div className="text-3xl font-bold">{stats.failed_posts || 0}</div>
        <div className="text-red-100 text-sm">Failed</div>
      </div>
    </div>
    
    {/* Connection Status */}
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Platform Connections</h3>
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Facebook className="w-8 h-8 text-blue-600" />
          <div>
            <ConnectionBadge connected={stats.facebook_connected} label="Facebook" />
            {stats.facebook_page_name && (
              <div className="text-xs text-gray-500 mt-1">Page: {stats.facebook_page_name}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Instagram className="w-8 h-8 text-pink-500" />
          <div>
            <ConnectionBadge connected={stats.instagram_connected} label="Instagram" />
            {stats.instagram_username && (
              <div className="text-xs text-gray-500 mt-1">@{stats.instagram_username}</div>
            )}
          </div>
        </div>
      </div>
    </div>
    
    {/* Quick Actions */}
    <div className="bg-white rounded-2xl p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>
    </div>
  </div>
);

// Create Post Tab
const CreatePostTab = ({ settings, onPostCreated }) => {
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [platforms, setPlatforms] = useState([]);
  const [scheduleMode, setScheduleMode] = useState('now');
  const [scheduleTime, setScheduleTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  
  const togglePlatform = (platform) => {
    if (platform === 'both') {
      setPlatforms(platforms.includes('facebook') && platforms.includes('instagram') ? [] : ['facebook', 'instagram']);
    } else {
      setPlatforms(prev => 
        prev.includes(platform) 
          ? prev.filter(p => p !== platform)
          : [...prev.filter(p => p !== 'both'), platform]
      );
    }
  };
  
  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, MP4, MOV');
      return;
    }
    
    // Validate file size
    const maxSize = file.type.startsWith('video') ? 25 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large. Max size: ${maxSize / (1024 * 1024)}MB`);
      return;
    }
    
    setUploading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await axios.post(`${API}/api/social/upload/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.success) {
        // Get the public URL
        const urlRes = await axios.get(`${API}/api/social/files/${res.data.file_id}/url`);
        const fileUrl = urlRes.data.url;
        
        if (file.type.startsWith('video')) {
          setVideoUrl(fileUrl);
        } else {
          setImageUrl(fileUrl);
        }
        
        setUploadedFile({
          id: res.data.file_id,
          name: file.name,
          type: file.type,
          url: fileUrl
        });
        
        setSuccess(`File uploaded successfully: ${file.name}`);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!caption.trim()) {
      setError('Caption is required');
      return;
    }
    
    if (platforms.length === 0) {
      setError('Select at least one platform');
      return;
    }
    
    if (scheduleMode === 'later' && !scheduleTime) {
      setError('Select schedule date and time');
      return;
    }
    
    // Check Instagram requires media
    if (platforms.includes('instagram') && !imageUrl && !videoUrl) {
      setError('Instagram requires an image or video');
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await axios.post(`${API}/api/social/posts/create`, {
        caption: caption.trim(),
        image_url: imageUrl.trim(),
        video_url: videoUrl.trim(),
        platforms,
        schedule_time: scheduleMode === 'later' ? new Date(scheduleTime).toISOString() : null
      });
      
      if (res.data.success) {
        setSuccess(res.data.message || 'Post created successfully');
        setCaption('');
        setImageUrl('');
        setVideoUrl('');
        setPlatforms([]);
        setScheduleTime('');
        onPostCreated?.();
      } else {
        setError(res.data.message || 'Failed to create post');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-800 mb-6">Create New Post</h3>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            {success}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Caption *</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your post caption..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
          
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Upload className="w-4 h-4 inline mr-1" />
              Upload from Device
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
                onChange={handleFileUpload}
                className="hidden"
                id="media-upload"
                disabled={uploading}
              />
              <label htmlFor="media-upload" className="cursor-pointer">
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                    <span className="text-gray-600">Uploading...</span>
                  </div>
                ) : uploadedFile ? (
                  <div className="flex flex-col items-center">
                    <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                    <span className="text-green-600 font-medium">{uploadedFile.name}</span>
                    <span className="text-xs text-gray-500 mt-1">Click to replace</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-gray-600">Click to upload image or video</span>
                    <span className="text-xs text-gray-400 mt-1">JPEG, PNG, GIF, WebP, MP4, MOV (Max 25MB)</span>
                  </div>
                )}
              </label>
            </div>
          </div>
          
          {/* Media URLs (Alternative) */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-500 mb-3">Or paste media URL directly:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Image className="w-4 h-4 inline mr-1" />
                Image URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Video className="w-4 h-4 inline mr-1" />
                Video URL
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            </div>
          </div>
          
          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Platforms *</label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => togglePlatform('facebook')}
                disabled={!settings.facebook_connected}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition ${
                  platforms.includes('facebook')
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                } ${!settings.facebook_connected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Facebook className="w-5 h-5" />
                Facebook
                {!settings.facebook_connected && <span className="text-xs">(Not connected)</span>}
              </button>
              <button
                type="button"
                onClick={() => togglePlatform('instagram')}
                disabled={!settings.instagram_connected}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition ${
                  platforms.includes('instagram')
                    ? 'bg-pink-50 border-pink-500 text-pink-700'
                    : 'border-gray-200 hover:border-gray-300'
                } ${!settings.instagram_connected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Instagram className="w-5 h-5" />
                Instagram
                {!settings.instagram_connected && <span className="text-xs">(Not connected)</span>}
              </button>
              <button
                type="button"
                onClick={() => togglePlatform('both')}
                disabled={!settings.facebook_connected || !settings.instagram_connected}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition ${
                  platforms.includes('facebook') && platforms.includes('instagram')
                    ? 'bg-purple-50 border-purple-500 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                } ${(!settings.facebook_connected || !settings.instagram_connected) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Both Platforms
              </button>
            </div>
          </div>
          
          {/* Schedule Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">When to Publish</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="schedule"
                  value="now"
                  checked={scheduleMode === 'now'}
                  onChange={() => setScheduleMode('now')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Publish Now</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="schedule"
                  value="later"
                  checked={scheduleMode === 'later'}
                  onChange={() => setScheduleMode('later')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Schedule Later</span>
              </label>
            </div>
            
            {scheduleMode === 'later' && (
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="create-social-post-btn"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : scheduleMode === 'now' ? (
              <Send className="w-5 h-5" />
            ) : (
              <Calendar className="w-5 h-5" />
            )}
            {loading ? 'Processing...' : scheduleMode === 'now' ? 'Publish Now' : 'Schedule Post'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Scheduled Posts Tab
const ScheduledTab = ({ onRefresh }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState(null);
  
  const fetchPosts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/social/posts/scheduled`);
      setPosts(res.data.posts || []);
    } catch (err) {
      console.error('Error fetching scheduled posts:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);
  
  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this scheduled post?')) return;
    
    try {
      await axios.delete(`${API}/api/social/posts/scheduled/${postId}`);
      setPosts(posts.filter(p => p.id !== postId));
      onRefresh?.();
    } catch (err) {
      alert('Failed to delete post');
    }
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Scheduled Posts</h3>
        <button
          onClick={fetchPosts}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      
      {posts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No scheduled posts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start gap-4">
                {/* Preview Image */}
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt="Post preview"
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 text-sm line-clamp-2 mb-2">{post.caption}</p>
                  
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {/* Platforms */}
                    <div className="flex items-center gap-1">
                      {post.platforms?.map(p => (
                        <PlatformIcon key={p} platform={p} className="w-4 h-4" />
                      ))}
                    </div>
                    
                    {/* Schedule Time */}
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-4 h-4" />
                      {formatDate(post.schedule_time)}
                    </div>
                    
                    {/* Status */}
                    <StatusBadge status={post.status} />
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditingPost(post)}
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Published Posts Tab
const PublishedTab = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  const fetchPosts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/social/posts?status=${filter}`);
      setPosts(res.data.posts || []);
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);
  
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-gray-800">Published Posts</h3>
        <div className="flex gap-2">
          {['all', 'published', 'failed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filter === f ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {posts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No posts found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Preview Image */}
              {post.image_url ? (
                <img
                  src={post.image_url}
                  alt="Post preview"
                  className="w-full h-40 object-cover"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=No+Image'; }}
                />
              ) : (
                <div className="w-full h-40 bg-gray-100 flex items-center justify-center">
                  <FileText className="w-12 h-12 text-gray-300" />
                </div>
              )}
              
              {/* Content */}
              <div className="p-4">
                <p className="text-gray-800 text-sm line-clamp-2 mb-3">{post.caption}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {post.platforms?.map(p => (
                      <PlatformIcon key={p} platform={p} className="w-4 h-4" />
                    ))}
                  </div>
                  <StatusBadge status={post.status} />
                </div>
                
                <div className="mt-2 text-xs text-gray-500">
                  {formatDate(post.published_at || post.created_at)}
                </div>
                
                {/* Results */}
                {post.results && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(post.results).map(([platform, result]) => (
                      <div key={platform} className={`text-xs ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                        {platform}: {result.success ? 'Success' : result.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Settings Tab
const SettingsTab = ({ settings, onRefresh }) => {
  const [fbPageId, setFbPageId] = useState('');
  const [fbAccessToken, setFbAccessToken] = useState('');
  const [igAccountId, setIgAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [testResults, setTestResults] = useState(null);
  
  useEffect(() => {
    setFbPageId(settings.facebook_page_id || '');
    setIgAccountId(settings.instagram_account_id || '');
  }, [settings]);
  
  const handleSave = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      await axios.post(`${API}/api/social/settings`, {
        facebook_page_id: fbPageId,
        facebook_access_token: fbAccessToken || undefined,
        instagram_account_id: igAccountId
      });
      
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setFbAccessToken('');
      onRefresh?.();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleConnectFacebook = async () => {
    if (!fbPageId || !fbAccessToken) {
      setMessage({ type: 'error', text: 'Page ID and Access Token are required' });
      return;
    }
    
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const res = await axios.post(`${API}/api/social/connect/facebook`, {
        page_id: fbPageId,
        access_token: fbAccessToken
      });
      
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        setFbAccessToken('');
        onRefresh?.();
      } else {
        setMessage({ type: 'error', text: res.data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to connect Facebook' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleConnectInstagram = async () => {
    if (!igAccountId) {
      setMessage({ type: 'error', text: 'Instagram Business Account ID is required' });
      return;
    }
    
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      const res = await axios.post(`${API}/api/social/connect/instagram`, {
        account_id: igAccountId
      });
      
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        onRefresh?.();
      } else {
        setMessage({ type: 'error', text: res.data.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to connect Instagram' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResults(null);
    
    try {
      const res = await axios.post(`${API}/api/social/test-connection`);
      setTestResults(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to test connections' });
    } finally {
      setTesting(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {message.text}
        </div>
      )}
      
      {/* Permissions Warning */}
      {settings.facebook_connected && !settings.facebook_has_posting_permissions && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-2">Missing Permissions</h4>
              <p className="text-sm mb-3">
                Your Page Access Token is missing required permissions. Posts will fail until you add these permissions:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 mb-3">
                <li><strong>pages_read_engagement</strong> - Read page content</li>
                <li><strong>pages_manage_posts</strong> - Publish and manage posts</li>
                <li><strong>pages_manage_engagement</strong> - Respond to comments</li>
              </ul>
              <p className="text-sm font-medium">
                Steps to fix:
              </p>
              <ol className="text-sm list-decimal list-inside space-y-1 mt-1">
                <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Meta Developer Console</a></li>
                <li>Select your App → App Review → Permissions</li>
                <li>Request the permissions listed above</li>
                <li>Generate a new Page Access Token with these permissions</li>
                <li>Update the token below</li>
              </ol>
            </div>
          </div>
        </div>
      )}
      
      {/* Facebook Settings */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Facebook className="w-8 h-8 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Facebook Page</h3>
            <div className="flex items-center gap-2 mt-1">
              <ConnectionBadge connected={settings.facebook_connected} label="Status" />
              {settings.facebook_connected && settings.facebook_has_posting_permissions && (
                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Permissions OK</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Page ID</label>
            <input
              type="text"
              value={fbPageId}
              onChange={(e) => setFbPageId(e.target.value)}
              placeholder="Enter your Facebook Page ID"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Page Access Token {settings.facebook_connected && '(Leave empty to keep current)'}
            </label>
            <input
              type="password"
              value={fbAccessToken}
              onChange={(e) => setFbAccessToken(e.target.value)}
              placeholder="Enter Page Access Token"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get from Facebook Developer Console → Your App → Page Access Token
            </p>
          </div>
          
          <button
            onClick={handleConnectFacebook}
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Link className="w-5 h-5" />}
            Connect Facebook
          </button>
        </div>
      </div>
      
      {/* Instagram Settings */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Instagram className="w-8 h-8 text-pink-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Instagram Business</h3>
            <ConnectionBadge connected={settings.instagram_connected} label="Status" />
          </div>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instagram Business Account ID</label>
            <input
              type="text"
              value={igAccountId}
              onChange={(e) => setIgAccountId(e.target.value)}
              placeholder="Enter your Instagram Business Account ID"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be linked to your Facebook Page. Get from Facebook Graph API Explorer.
            </p>
          </div>
          
          <button
            onClick={handleConnectInstagram}
            disabled={loading || !settings.facebook_connected}
            className="w-full py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-medium hover:from-pink-600 hover:to-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Link className="w-5 h-5" />}
            Connect Instagram
          </button>
          {!settings.facebook_connected && (
            <p className="text-xs text-amber-600 text-center">Connect Facebook first to enable Instagram</p>
          )}
        </div>
      </div>
      
      {/* Test Connection */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Test Connections</h3>
        
        <button
          onClick={handleTestConnection}
          disabled={testing}
          className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-medium transition flex items-center justify-center gap-2"
        >
          {testing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
          {testing ? 'Testing...' : 'Test All Connections'}
        </button>
        
        {testResults && (
          <div className="mt-4 space-y-2">
            <div className={`p-3 rounded-lg ${testResults.facebook?.connected ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2">
                <Facebook className="w-5 h-5 text-blue-600" />
                <span className={`font-medium ${testResults.facebook?.connected ? 'text-green-700' : 'text-red-700'}`}>
                  Facebook: {testResults.facebook?.status}
                </span>
              </div>
            </div>
            <div className={`p-3 rounded-lg ${testResults.instagram?.connected ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2">
                <Instagram className="w-5 h-5 text-pink-500" />
                <span className={`font-medium ${testResults.instagram?.connected ? 'text-green-700' : 'text-red-700'}`}>
                  Instagram: {testResults.instagram?.status}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Website Gallery Sync Tab - Sync Facebook posts to website gallery
const GalleryTab = ({ onRefresh }) => {
  const [galleryItems, setGalleryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('all');
  
  const fetchGallery = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/social/gallery?include_hidden=true`);
      setGalleryItems(res.data.items || []);
    } catch (err) {
      console.error('Error fetching gallery:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);
  
  const syncFromFacebook = async () => {
    setSyncing(true);
    try {
      const res = await axios.post(`${API}/api/social/facebook/posts/sync`);
      if (res.data.success) {
        alert(`✅ Synced ${res.data.synced_count} new posts from Facebook!`);
        fetchGallery();
      } else {
        alert(`❌ Sync failed: ${res.data.error}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSyncing(false);
    }
  };
  
  const updateItem = async (itemId, updates) => {
    try {
      await axios.put(`${API}/api/social/gallery/${itemId}`, updates);
      fetchGallery();
    } catch (err) {
      console.error('Error updating item:', err);
    }
  };
  
  const deleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await axios.delete(`${API}/api/social/gallery/${itemId}`);
      fetchGallery();
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };
  
  const filteredItems = galleryItems.filter(item => {
    if (filter === 'gallery') return item.show_on_gallery;
    if (filter === 'latest_work') return item.show_on_latest_work;
    if (filter === 'featured') return item.featured;
    if (filter === 'hidden') return item.hidden;
    return true;
  });
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Website Gallery Sync</h3>
          <p className="text-sm text-gray-600">Sync Facebook posts and manage website gallery/latest work display</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={syncFromFacebook}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from Facebook'}
          </button>
          <button
            onClick={fetchGallery}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'All Items' },
          { id: 'gallery', label: 'Show on Gallery' },
          { id: 'latest_work', label: 'Latest Work' },
          { id: 'featured', label: 'Featured' },
          { id: 'hidden', label: 'Hidden' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              filter === f.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      
      {/* Gallery Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Image className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No gallery items found</p>
          <button
            onClick={syncFromFacebook}
            className="mt-4 text-blue-600 hover:underline text-sm"
          >
            Sync from Facebook to get started
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Media Preview */}
              <div className="relative aspect-video bg-gray-100">
                {item.media_url ? (
                  item.media_type === 'video' ? (
                    <video src={item.media_url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.media_url} alt={item.title} className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-12 h-12 text-gray-300" />
                  </div>
                )}
                {/* Source badge */}
                <div className="absolute top-2 left-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.source === 'facebook' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-white'
                  }`}>
                    {item.source === 'facebook' ? 'Facebook' : 'Manual'}
                  </span>
                </div>
                {item.featured && (
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500 text-white">
                      ⭐ Featured
                    </span>
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="p-4 space-y-3">
                <p className="text-sm text-gray-700 line-clamp-2">{item.caption || item.title || 'No caption'}</p>
                <p className="text-xs text-gray-400">{item.created_time ? new Date(item.created_time).toLocaleDateString() : 'Unknown date'}</p>
                
                {/* Toggle Controls */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.show_on_gallery || false}
                      onChange={(e) => updateItem(item.id, { show_on_gallery: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Show on Gallery</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.show_on_latest_work || false}
                      onChange={(e) => updateItem(item.id, { show_on_latest_work: e.target.checked })}
                      className="rounded text-green-600"
                    />
                    <span className="text-sm text-gray-700">Show on Latest Work</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.featured || false}
                      onChange={(e) => updateItem(item.id, { featured: e.target.checked })}
                      className="rounded text-amber-600"
                    />
                    <span className="text-sm text-gray-700">Featured</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.hidden || false}
                      onChange={(e) => updateItem(item.id, { hidden: e.target.checked })}
                      className="rounded text-red-600"
                    />
                    <span className="text-sm text-gray-700">Hide</span>
                  </label>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  {item.permalink_url && (
                    <a
                      href={item.permalink_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <Link className="w-3 h-3" /> View on FB
                    </a>
                  )}
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="flex items-center gap-1 text-xs text-red-600 hover:underline ml-auto"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Main Social Media Manager Component
export const SocialMediaManager = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({});
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/api/social/dashboard/stats`),
        axios.get(`${API}/api/social/settings`)
      ]);
      setStats(statsRes.data);
      setSettings(settingsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'create', label: 'Create Post', icon: Plus },
    { id: 'gallery', label: 'Website Gallery', icon: Image },
    { id: 'scheduled', label: 'Scheduled', icon: Calendar },
    { id: 'published', label: 'Published', icon: CheckCircle },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Social Media Manager</h2>
          <p className="text-gray-600">Manage Facebook & Instagram posts</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'dashboard' && (
          <DashboardTab stats={stats} onRefresh={fetchData} loading={loading} />
        )}
        {activeTab === 'create' && (
          <CreatePostTab settings={settings} onPostCreated={fetchData} />
        )}
        {activeTab === 'gallery' && (
          <GalleryTab onRefresh={fetchData} />
        )}
        {activeTab === 'scheduled' && (
          <ScheduledTab onRefresh={fetchData} />
        )}
        {activeTab === 'published' && (
          <PublishedTab />
        )}
        {activeTab === 'settings' && (
          <SettingsTab settings={settings} onRefresh={fetchData} />
        )}
      </div>
    </div>
  );
};

export default SocialMediaManager;
