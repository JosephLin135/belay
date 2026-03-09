import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

// Types
type PostCategory = 'general' | 'gym' | 'beta' | 'gear' | 'training';

interface Post {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  category: PostCategory;
  gym_name?: string;
  title: string;
  content: string;
  likes: number;
  comments_count: number;
  created_at: string;
  liked_by_user?: boolean;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  created_at: string;
  likes_count?: number;
}

interface TopComment {
  [postId: string]: Comment | null;
}

// Category config
const CATEGORIES: { key: PostCategory; label: string; icon: string; color: string }[] = [
  { key: 'general', label: 'General', icon: 'chatbubbles', color: '#1e4620' },
  { key: 'gym', label: 'Gym Talk', icon: 'location', color: '#E85D75' },
  { key: 'beta', label: 'Beta Request', icon: 'bulb', color: '#F5A623' },
  { key: 'gear', label: 'Gear', icon: 'construct', color: '#7ED321' },
  { key: 'training', label: 'Training', icon: 'fitness', color: '#9B59B6' },
];

// Helper to format time ago
function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function CommunityScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PostCategory | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [topComments, setTopComments] = useState<TopComment>({});
  
  // Modal states
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [showPostDetailModal, setShowPostDetailModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [pendingScrollToComments, setPendingScrollToComments] = useState(false);
  const [commentsSectionY, setCommentsSectionY] = useState(0);
  const detailScrollRef = useRef<ScrollView>(null);
  
  // New post form
  const [newPostCategory, setNewPostCategory] = useState<PostCategory>('general');
  const [newPostGym, setNewPostGym] = useState('');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // New comment
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  
  // Edit states
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editPostTitle, setEditPostTitle] = useState('');
  const [editPostContent, setEditPostContent] = useState('');
  const [showEditPostModal, setShowEditPostModal] = useState(false);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [showEditCommentModal, setShowEditCommentModal] = useState(false);

  // Get current user on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
    
    // Start fetching posts immediately, don't wait for user
    fetchPosts();
  }, []);

  // Fetch posts from Supabase
  const fetchPosts = useCallback(async () => {
    try {
      // Fetch posts with user info, likes count, and comments count
      const { data: postsData, error: postsError } = await supabase
        .from('community_posts_with_details')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Limit for better performance

      if (postsError) throw postsError;

      // Get current user for checking likes (parallel fetch)
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      // If user is logged in, check which posts they've liked
      let likedPostIds: string[] = [];
      if (userId && postsData && postsData.length > 0) {
        const postIds = postsData.map((p: any) => p.id);
        const { data: likesData } = await supabase
          .from('community_likes')
          .select('post_id')
          .eq('user_id', userId)
          .in('post_id', postIds); // Only check likes for fetched posts
        
        likedPostIds = likesData?.map((l: { post_id: string }) => l.post_id) || [];
      }

      // Map posts with liked_by_user flag
    interface CommunityPostWithDetails extends Post {
        // Add any extra fields from 'community_posts_with_details' if needed
    }

    interface CommunityLike {
        post_id: string;
        user_id: string;
    }

    const postsWithLikes: Post[] = ((postsData || []) as CommunityPostWithDetails[]).map((post: CommunityPostWithDetails) => ({
        ...post,
        liked_by_user: likedPostIds.includes(post.id),
    }));

      setPosts(postsWithLikes);
      setLoading(false);
      setRefreshing(false);
      
      // Fetch top comments in background (non-blocking)
      if (postsWithLikes.length > 0) {
        fetchTopComments(postsWithLikes.map(p => p.id));
      }
    } catch (error: any) {
      console.error('Error fetching posts:', error.message);
      Alert.alert('Error', 'Failed to load posts. Please try again.');
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch top comment (most likes) for each post
  const fetchTopComments = async (postIds: string[]) => {
    if (postIds.length === 0) return;
    
    try {
      // Get all comments for these posts with like counts - single query
      const { data: commentsData, error } = await supabase
        .from('community_comments_with_user')
        .select('*')
        .in('post_id', postIds)
        .limit(200); // Limit comments
      
      if (error) throw error;
      
      if (!commentsData || commentsData.length === 0) {
        setTopComments({});
        return;
      }
      
      // Get comment IDs to fetch only relevant likes
      const commentIds = commentsData.map((c: any) => c.id);
      
      // Get like counts only for these comments
      const { data: commentLikes } = await supabase
        .from('community_comment_likes')
        .select('comment_id')
        .in('comment_id', commentIds);
      
      const likeCounts: { [key: string]: number } = {};
      commentLikes?.forEach((like: { comment_id: string }) => {
        likeCounts[like.comment_id] = (likeCounts[like.comment_id] || 0) + 1;
      });
      
      // Group by post_id and find top comment
      const topCommentsMap: TopComment = {};
      postIds.forEach(postId => {
        const postComments = (commentsData || [])
          .filter((c: Comment) => c.post_id === postId)
          .map((c: Comment) => ({ ...c, likes_count: likeCounts[c.id] || 0 }))
          .sort((a: Comment, b: Comment) => (b.likes_count || 0) - (a.likes_count || 0));
        
        topCommentsMap[postId] = postComments.length > 0 ? postComments[0] : null;
      });
      
      setTopComments(topCommentsMap);
    } catch (error: any) {
      console.error('Error fetching top comments:', error.message);
    }
  };

  // Re-fetch when user changes (to update liked status)
  useEffect(() => {
    if (currentUserId && posts.length > 0) {
      // Just update the liked status without full refetch
      const updateLikedStatus = async () => {
        const postIds = posts.map(p => p.id);
        const { data: likesData } = await supabase
          .from('community_likes')
          .select('post_id')
          .eq('user_id', currentUserId)
          .in('post_id', postIds);
        
        const likedPostIds = likesData?.map((l: { post_id: string }) => l.post_id) || [];
        setPosts(prev => prev.map(post => ({
          ...post,
          liked_by_user: likedPostIds.includes(post.id),
        })));
      };
      updateLikedStatus();
    }
  }, [currentUserId]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, [fetchPosts]);

  // Filter posts by category
  const filteredPosts = selectedCategory === 'all' 
    ? posts 
    : posts.filter(p => p.category === selectedCategory);

  // Handle like/unlike
  const handleLikePost = async (postId: string) => {
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to like posts.');
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const wasLiked = post.liked_by_user;

    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          likes: wasLiked ? p.likes - 1 : p.likes + 1,
          liked_by_user: !wasLiked,
        };
      }
      return p;
    }));

    // Also update selectedPost if viewing detail
    if (selectedPost?.id === postId) {
      setSelectedPost(prev => prev ? {
        ...prev,
        likes: wasLiked ? prev.likes - 1 : prev.likes + 1,
        liked_by_user: !wasLiked,
      } : null);
    }

    try {
      if (wasLiked) {
        // Remove like
        const { error } = await supabase
          .from('community_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId);
        
        if (error) throw error;
      } else {
        // Add like
        const { error } = await supabase
          .from('community_likes')
          .insert({ post_id: postId, user_id: currentUserId });
        
        if (error) throw error;
      }
    } catch (error: any) {
      console.error('Error toggling like:', error.message);
      // Revert optimistic update on error
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likes: wasLiked ? p.likes + 1 : p.likes - 1,
            liked_by_user: wasLiked,
          };
        }
        return p;
      }));
    }
  };

  // Fetch comments for a post
  const fetchComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('community_comments_with_user')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      console.error('Error fetching comments:', error.message);
    } finally {
      setLoadingComments(false);
    }
  };

  // Open post detail (full view)
  const handleOpenPost = (post: Post) => {
    setSelectedPost(post);
    setCommentsSectionY(0);
    setPendingScrollToComments(false);
    setShowPostDetailModal(true);
    fetchComments(post.id);
  };

  // Open comments modal (YouTube-style popup)
  const handleOpenComments = (post: Post) => {
    setSelectedPost(post);
    setCommentsSectionY(0);
    setPendingScrollToComments(true);
    setShowPostDetailModal(true);
    fetchComments(post.id);
  };

  // Close post detail modal
  const handleClosePostDetail = () => {
    setShowPostDetailModal(false);
    setPendingScrollToComments(false);
    setCommentsSectionY(0);
  };

  useEffect(() => {
    if (pendingScrollToComments && showPostDetailModal && commentsSectionY > 0) {
      detailScrollRef.current?.scrollTo({ y: commentsSectionY, animated: false });
      setPendingScrollToComments(false);
    }
  }, [pendingScrollToComments, showPostDetailModal, commentsSectionY]);

  // Share post
  const handleSharePost = async (post: Post) => {
    try {
      const shareMessage = post.gym_name 
        ? `${post.title}\n\n${post.content}\n\n📍 ${post.gym_name}\n\nShared from Cruxly - The Climbing Community`
        : `${post.title}\n\n${post.content}\n\nShared from Cruxly - The Climbing Community`;
      
      await Share.share({
        message: shareMessage,
        title: post.title,
      });
    } catch (error: any) {
      if (error.message !== 'User did not share') {
        console.error('Error sharing:', error.message);
      }
    }
  };

  // Create new post
  const handleCreatePost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      Alert.alert('Missing Fields', 'Please enter a title and content for your post.');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to create posts.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('community_posts')
        .insert({
          user_id: currentUserId,
          category: newPostCategory,
          gym_name: (newPostCategory === 'gym' || newPostCategory === 'beta') && newPostGym.trim() 
            ? newPostGym.trim() 
            : null,
          title: newPostTitle.trim(),
          content: newPostContent.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh posts to get the new one with all details
      await fetchPosts();

      // Reset form and close modal
      setShowNewPostModal(false);
      setNewPostCategory('general');
      setNewPostGym('');
      setNewPostTitle('');
      setNewPostContent('');
    } catch (error: any) {
      console.error('Error creating post:', error.message);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Add comment
  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedPost) return;

    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to comment.');
      return;
    }

    setSubmittingComment(true);
    try {
      const { data, error } = await supabase
        .from('community_comments')
        .insert({
          post_id: selectedPost.id,
          user_id: currentUserId,
          content: newComment.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Fetch user profile for the new comment
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', currentUserId)
        .single();

      // Add the new comment to the list
      const newCommentWithUser: Comment = {
        id: data.id,
        post_id: data.post_id,
        user_id: data.user_id,
        user_name: profileData?.display_name || 'Climber',
        user_avatar: profileData?.avatar_url,
        content: data.content,
        created_at: data.created_at,
      };

      setComments(prev => [...prev, newCommentWithUser]);
      
      // Update comment count in posts list and selected post
      setPosts(prev => prev.map(p => 
        p.id === selectedPost.id 
          ? { ...p, comments_count: p.comments_count + 1 }
          : p
      ));
      setSelectedPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : null);
      
      setNewComment('');
    } catch (error: any) {
      console.error('Error adding comment:', error.message);
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Edit Post
  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setEditPostTitle(post.title);
    setEditPostContent(post.content);
    setShowEditPostModal(true);
  };

  const handleSaveEditPost = async () => {
    if (!editingPost || !editPostTitle.trim() || !editPostContent.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('community_posts')
        .update({
          title: editPostTitle.trim(),
          content: editPostContent.trim(),
        })
        .eq('id', editingPost.id)
        .eq('user_id', currentUserId); // Ensure user owns the post

      if (error) throw error;

      // Update local state
      const updatedPost = {
        ...editingPost,
        title: editPostTitle.trim(),
        content: editPostContent.trim(),
      };
      
      setPosts(prev => prev.map(p => p.id === editingPost.id ? updatedPost : p));
      if (selectedPost?.id === editingPost.id) {
        setSelectedPost(updatedPost);
      }
      
      setShowEditPostModal(false);
      setEditingPost(null);
      Alert.alert('Success', 'Post updated successfully.');
    } catch (error: any) {
      console.error('Error updating post:', error.message);
      Alert.alert('Error', 'Failed to update post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Post
  const handleDeletePost = (post: Post) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('community_posts')
                .delete()
                .eq('id', post.id)
                .eq('user_id', currentUserId); // Ensure user owns the post

              if (error) throw error;

              setPosts(prev => prev.filter(p => p.id !== post.id));
              if (selectedPost?.id === post.id) {
                handleClosePostDetail();
              }
              Alert.alert('Success', 'Post deleted successfully.');
            } catch (error: any) {
              console.error('Error deleting post:', error.message);
              Alert.alert('Error', 'Failed to delete post. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Edit Comment
  const handleEditComment = (comment: Comment) => {
    setEditingComment(comment);
    setEditCommentContent(comment.content);
    setShowEditCommentModal(true);
  };

  const handleSaveEditComment = async () => {
    if (!editingComment || !editCommentContent.trim()) return;

    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('community_comments')
        .update({
          content: editCommentContent.trim(),
        })
        .eq('id', editingComment.id)
        .eq('user_id', currentUserId); // Ensure user owns the comment

      if (error) throw error;

      // Update local state
      setComments(prev => prev.map(c => 
        c.id === editingComment.id 
          ? { ...c, content: editCommentContent.trim() }
          : c
      ));
      
      setShowEditCommentModal(false);
      setEditingComment(null);
    } catch (error: any) {
      console.error('Error updating comment:', error.message);
      Alert.alert('Error', 'Failed to update comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete Comment
  const handleDeleteComment = (comment: Comment) => {
    Alert.alert(
      'Delete Reply',
      'Are you sure you want to delete this reply?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('community_comments')
                .delete()
                .eq('id', comment.id)
                .eq('user_id', currentUserId); // Ensure user owns the comment

              if (error) throw error;

              setComments(prev => prev.filter(c => c.id !== comment.id));
              
              // Update comment count
              if (selectedPost) {
                const newCount = selectedPost.comments_count - 1;
                setPosts(prev => prev.map(p => 
                  p.id === selectedPost.id 
                    ? { ...p, comments_count: newCount }
                    : p
                ));
                setSelectedPost(prev => prev ? { ...prev, comments_count: newCount } : null);
              }
            } catch (error: any) {
              console.error('Error deleting comment:', error.message);
              Alert.alert('Error', 'Failed to delete reply. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Show action menu for post
  const showPostActions = (post: Post) => {
    Alert.alert(
      'Post Options',
      undefined,
      [
        { text: 'Edit', onPress: () => handleEditPost(post) },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeletePost(post) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Show action menu for comment
  const showCommentActions = (comment: Comment) => {
    Alert.alert(
      'Reply Options',
      undefined,
      [
        { text: 'Edit', onPress: () => handleEditComment(comment) },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteComment(comment) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Close Edit Comment Modal
  const closeEditCommentModal = () => {
    setShowEditCommentModal(false);
    setEditingComment(null);
    setEditCommentContent('');
  };

  const getCategoryConfig = (key: PostCategory) => {
    return CATEGORIES.find(c => c.key === key) || CATEGORIES[0];
  };

  // Render post card
  const renderPostCard = ({ item }: { item: Post }) => {
    const categoryConfig = getCategoryConfig(item.category);
    
    return (
      <TouchableOpacity 
        style={styles.postCard}
        onPress={() => handleOpenPost(item)}
        activeOpacity={0.7}
      >
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={styles.postUserInfo}>
            {item.user_avatar ? (
              <Image source={{ uri: item.user_avatar }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: categoryConfig.color }]}>
                <Text style={styles.avatarText}>{item.user_name[0].toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={styles.userName}>{item.user_name}</Text>
              <Text style={styles.postTime}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
          <View style={styles.postHeaderRight}>
            <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '20' }]}>
              <Ionicons name={categoryConfig.icon as any} size={12} color={categoryConfig.color} />
              <Text style={[styles.categoryBadgeText, { color: categoryConfig.color }]}>
                {categoryConfig.label}
              </Text>
            </View>
            {item.user_id === currentUserId && (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={(e) => {
                  e.stopPropagation();
                  showPostActions(item);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        {/* Gym Tag */}
        {item.gym_name && (
          <View style={styles.gymTag}>
            <Ionicons name="location" size={12} color="#64748B" />
            <Text style={styles.gymTagText}>{item.gym_name}</Text>
          </View>
        )}
        
        {/* Post Content */}
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>
        
        {/* Post Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity 
            style={styles.postAction}
            onPress={(e) => {
              e.stopPropagation();
              handleLikePost(item.id);
            }}
          >
            <Ionicons 
              name={item.liked_by_user ? "heart" : "heart-outline"} 
              size={20} 
              color={item.liked_by_user ? "#E85D75" : "#64748B"} 
            />
            <Text style={[styles.postActionText, item.liked_by_user && { color: '#E85D75' }]}>
              {item.likes}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.postAction}
            onPress={(e) => {
              e.stopPropagation();
              handleOpenComments(item);
            }}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#64748B" />
            <Text style={styles.postActionText}>{item.comments_count}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.postAction}
            onPress={(e) => {
              e.stopPropagation();
              handleSharePost(item);
            }}
          >
            <Ionicons name="share-outline" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Top Comment Preview */}
        {topComments[item.id] && item.comments_count > 0 && (
          <TouchableOpacity 
            style={styles.topCommentPreview}
            onPress={(e) => {
              e.stopPropagation();
              handleOpenComments(item);
            }}
          >
            <View style={styles.topCommentHeader}>
              <Ionicons name="chatbubble" size={12} color="#1e4620" />
              <Text style={styles.topCommentLabel}>Top Reply</Text>
            </View>
            <View style={styles.topCommentContent}>
              <Text style={styles.topCommentUser}>{topComments[item.id]?.user_name}</Text>
              <Text style={styles.topCommentText} numberOfLines={2}>
                {topComments[item.id]?.content}
              </Text>
            </View>
            {item.comments_count > 1 && (
              <Text style={styles.viewMoreComments}>
                View all {item.comments_count} replies →
              </Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Hero Header */}
      <LinearGradient
        colors={['#1e4620', '#449e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroHeader, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Boulder Talk</Text>
          <Text style={styles.heroSubtitle}>Connect with fellow climbers</Text>
        </View>
        <TouchableOpacity 
          style={styles.newPostButton}
          onPress={() => setShowNewPostModal(true)}
        >
          <Ionicons name="add" size={24} color="#1e4620" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Category Filter */}
      <View style={styles.categoryFilter}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryFilterContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryPill,
              selectedCategory === 'all' && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[
              styles.categoryPillText,
              selectedCategory === 'all' && styles.categoryPillTextActive,
            ]}>All</Text>
          </TouchableOpacity>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryPill,
                selectedCategory === cat.key && { backgroundColor: cat.color },
              ]}
              onPress={() => setSelectedCategory(cat.key)}
            >
              <Ionicons 
                name={cat.icon as any} 
                size={14} 
                color={selectedCategory === cat.key ? '#FFF' : '#64748B'} 
              />
              <Text style={[
                styles.categoryPillText,
                selectedCategory === cat.key && styles.categoryPillTextActive,
              ]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Loading State */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e4620" />
          <Text style={styles.loadingText}>Loading discussions...</Text>
        </View>
      ) : (
        /* Posts List */
        <FlatList
          data={filteredPosts}
          renderItem={renderPostCard}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.postsList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e4620" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubbles-outline" size={48} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySubtitle}>Be the first to start a discussion!</Text>
              <TouchableOpacity 
                style={styles.emptyButton}
                onPress={() => setShowNewPostModal(true)}
              >
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.emptyButtonText}>Create Post</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* New Post Modal */}
      <Modal
        visible={showNewPostModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewPostModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <LinearGradient
              colors={['#1e4620', '#449e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalHeader}
            >
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="create" size={28} color="#1e4620" />
              </View>
              <Text style={styles.modalHeaderTitle}>New Post</Text>
              <Text style={styles.modalHeaderSubtitle}>Share your thoughts with the community</Text>
            </LinearGradient>
            
            <ScrollView style={styles.modalBody}>
              {/* Category Selection */}
              <Text style={styles.formLabel}>Category</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.categorySelect}
              >
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categorySelectItem,
                      newPostCategory === cat.key && { backgroundColor: cat.color },
                    ]}
                    onPress={() => setNewPostCategory(cat.key)}
                  >
                    <Ionicons 
                      name={cat.icon as any} 
                      size={16} 
                      color={newPostCategory === cat.key ? '#FFF' : '#64748B'} 
                    />
                    <Text style={[
                      styles.categorySelectText,
                      newPostCategory === cat.key && { color: '#FFF' },
                    ]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Gym Input (conditional) */}
              {(newPostCategory === 'gym' || newPostCategory === 'beta') && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Gym Name</Text>
                  <View style={styles.formInputWrapper}>
                    <Ionicons name="location" size={20} color="#94A3B8" />
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g., Movement Gowanus"
                      placeholderTextColor="#94A3B8"
                      value={newPostGym}
                      onChangeText={setNewPostGym}
                    />
                  </View>
                </View>
              )}

              {/* Title */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Title</Text>
                <View style={styles.formInputWrapper}>
                  <TextInput
                    style={styles.formInput}
                    placeholder="What's on your mind?"
                    placeholderTextColor="#94A3B8"
                    value={newPostTitle}
                    onChangeText={setNewPostTitle}
                  />
                </View>
              </View>

              {/* Content */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Details</Text>
                <View style={[styles.formInputWrapper, styles.formTextAreaWrapper]}>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    placeholder="Share more details, ask questions, or describe the problem..."
                    placeholderTextColor="#94A3B8"
                    value={newPostContent}
                    onChangeText={setNewPostContent}
                    multiline
                    numberOfLines={5}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowNewPostModal(false)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalPostButton, submitting && { opacity: 0.7 }]}
                onPress={handleCreatePost}
                disabled={submitting}
              >
                <LinearGradient
                  colors={['#1e4620', '#449e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalPostGradient}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#FFF" />
                      <Text style={styles.modalPostText}>Post</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Post Detail Modal - Full Screen Rollover */}
      <Modal
        visible={showPostDetailModal}
        transparent={false}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClosePostDetail}
      >
        <SafeAreaView style={styles.detailModalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Header */}
            <View style={styles.detailHeader}>
              <TouchableOpacity 
                onPress={handleClosePostDetail}
                style={styles.detailBackButton}
              >
                <Ionicons name="chevron-down" size={28} color="#1E293B" />
              </TouchableOpacity>
              <Text style={styles.detailHeaderTitle}>Discussion</Text>
              <TouchableOpacity 
                onPress={() => selectedPost && handleSharePost(selectedPost)}
                style={styles.detailShareButton}
              >
                <Ionicons name="share-outline" size={22} color="#1E293B" />
              </TouchableOpacity>
            </View>

            {selectedPost && (
              <>
                {/* Post Content */}
                <ScrollView 
                  style={styles.detailBody} 
                  ref={detailScrollRef}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Main Post Card */}
                  <View style={styles.detailPostCard}>
                    {/* Category Badge */}
                    <View style={[styles.detailCategoryBadge, { backgroundColor: getCategoryConfig(selectedPost.category).color + '20' }]}>
                      <Ionicons 
                        name={getCategoryConfig(selectedPost.category).icon as any} 
                        size={14} 
                        color={getCategoryConfig(selectedPost.category).color} 
                      />
                      <Text style={[styles.detailCategoryText, { color: getCategoryConfig(selectedPost.category).color }]}>
                        {getCategoryConfig(selectedPost.category).label}
                      </Text>
                    </View>

                    {/* Title */}
                    <Text style={styles.detailPostTitle}>{selectedPost.title}</Text>

                    {/* User Info */}
                    <View style={styles.detailUserRow}>
                      {selectedPost.user_avatar ? (
                        <Image source={{ uri: selectedPost.user_avatar }} style={styles.detailAvatarImage} />
                      ) : (
                        <View style={[styles.detailAvatar, { backgroundColor: getCategoryConfig(selectedPost.category).color }]}>
                          <Text style={styles.detailAvatarText}>{selectedPost.user_name[0].toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={styles.detailUserInfo}>
                        <Text style={styles.detailUserName}>{selectedPost.user_name}</Text>
                        <Text style={styles.detailPostTime}>{timeAgo(selectedPost.created_at)}</Text>
                      </View>
                      {selectedPost.user_id === currentUserId && (
                        <TouchableOpacity
                          style={styles.detailMoreButton}
                          onPress={() => showPostActions(selectedPost)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="ellipsis-horizontal" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>

                    {selectedPost.gym_name && (
                      <View style={styles.detailGymTag}>
                        <Ionicons name="location" size={14} color="#64748B" />
                        <Text style={styles.detailGymTagText}>{selectedPost.gym_name}</Text>
                      </View>
                    )}

                    <Text style={styles.detailPostContent}>{selectedPost.content}</Text>

                    {/* Actions */}
                    <View style={styles.detailActions}>
                      <TouchableOpacity 
                        style={styles.detailAction}
                        onPress={() => handleLikePost(selectedPost.id)}
                      >
                        <Ionicons 
                          name={selectedPost.liked_by_user ? "heart" : "heart-outline"} 
                          size={22} 
                          color={selectedPost.liked_by_user ? "#E85D75" : "#64748B"} 
                        />
                        <Text style={[styles.detailActionText, selectedPost.liked_by_user && { color: '#E85D75' }]}>
                          {selectedPost.likes} {selectedPost.likes === 1 ? 'like' : 'likes'}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.detailAction}>
                        <Ionicons name="chatbubble" size={20} color="#1e4620" />
                        <Text style={[styles.detailActionText, { color: '#1e4620' }]}>
                          {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Replies Section */}
                  <View
                    style={styles.repliesSection}
                    onLayout={(event) => {
                      setCommentsSectionY(event.nativeEvent.layout.y);
                    }}
                  >
                    <View style={styles.repliesSectionHeader}>
                      <Text style={styles.repliesSectionTitle}>Replies</Text>
                      <Text style={styles.repliesSectionCount}>{comments.length}</Text>
                    </View>
                    
                    {loadingComments ? (
                      <View style={styles.loadingComments}>
                        <ActivityIndicator size="small" color="#1e4620" />
                        <Text style={styles.loadingCommentsText}>Loading replies...</Text>
                      </View>
                    ) : comments.length > 0 ? (
                      comments.map((comment, index) => (
                        <View 
                          key={comment.id} 
                          style={[
                            styles.replyCard,
                            index === comments.length - 1 && { borderBottomWidth: 0 }
                          ]}
                        >
                          <View style={styles.replyHeader}>
                            {comment.user_avatar ? (
                              <Image source={{ uri: comment.user_avatar }} style={styles.replyAvatarImage} />
                            ) : (
                              <View style={styles.replyAvatar}>
                                <Text style={styles.replyAvatarText}>
                                  {comment.user_name[0].toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View style={styles.replyUserInfo}>
                              <Text style={styles.replyUserName}>{comment.user_name}</Text>
                              <Text style={styles.replyTime}>{timeAgo(comment.created_at)}</Text>
                            </View>
                            {comment.user_id === currentUserId && (
                              <TouchableOpacity
                                style={styles.replyMoreButton}
                                onPress={() => showCommentActions(comment)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons name="ellipsis-horizontal" size={16} color="#94A3B8" />
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text style={styles.replyContent}>{comment.content}</Text>
                        </View>
                      ))
                    ) : (
                      <View style={styles.noReplies}>
                        <View style={styles.noRepliesIconContainer}>
                          <Ionicons name="chatbubble-outline" size={40} color="#CBD5E1" />
                        </View>
                        <Text style={styles.noRepliesTitle}>No replies yet</Text>
                        <Text style={styles.noRepliesSubtitle}>Be the first to join the conversation!</Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Bottom padding for input */}
                  <View style={{ height: 100 }} />
                </ScrollView>

                {/* Comment Input */}
                <View style={styles.replyInputContainer}>
                  <View style={styles.replyInputWrapper}>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Write a reply..."
                      placeholderTextColor="#94A3B8"
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                      maxLength={500}
                    />
                    <TouchableOpacity 
                      style={[
                        styles.replySendButton,
                        !newComment.trim() && styles.replySendButtonDisabled,
                      ]}
                      onPress={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                    >
                      {submittingComment ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Ionicons name="send" size={18} color={newComment.trim() ? '#FFF' : '#94A3B8'} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Edit Post Modal */}
      <Modal
        visible={showEditPostModal}
        transparent={false}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditPostModal(false)}
      >
        <SafeAreaView style={styles.detailModalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.editModalHeader}>
              <TouchableOpacity onPress={() => setShowEditPostModal(false)}>
                <Ionicons name="chevron-down" size={28} color="#1E293B" />
              </TouchableOpacity>
              <Text style={styles.editModalHeaderTitle}>Edit Post</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.editModalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Title</Text>
                <TextInput
                  style={styles.editTitleInput}
                  placeholder="Post title"
                  placeholderTextColor="#94A3B8"
                  value={editPostTitle}
                  onChangeText={setEditPostTitle}
                  autoFocus
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Content</Text>
                <TextInput
                  style={styles.editTextArea}
                  placeholder="Post content"
                  placeholderTextColor="#94A3B8"
                  value={editPostContent}
                  onChangeText={setEditPostContent}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            <View style={styles.editModalFooter}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowEditPostModal(false)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editSaveButton, (!editPostTitle.trim() || !editPostContent.trim() || submitting) && { opacity: 0.5 }]}
                onPress={handleSaveEditPost}
                disabled={submitting || !editPostTitle.trim() || !editPostContent.trim()}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.editSaveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Edit Comment Modal (guaranteed to show and be editable) */}
      <Modal
        visible={showEditCommentModal}
        transparent={false}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditCommentModal}
      >
        <SafeAreaView style={styles.detailModalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.editModalHeader}>
              <TouchableOpacity onPress={closeEditCommentModal}>
                <Ionicons name="chevron-down" size={28} color="#1E293B" />
              </TouchableOpacity>
              <Text style={styles.editModalHeaderTitle}>Edit Reply</Text>
              <View style={{ width: 28 }} />
            </View>
            <View style={styles.editModalBody}>
              <Text style={styles.formLabel}>Your Reply</Text>
              <TextInput
                style={styles.editTextArea}
                placeholder="Your reply"
                placeholderTextColor="#94A3B8"
                value={editCommentContent}
                onChangeText={setEditCommentContent}
                multiline
                autoFocus
                textAlignVertical="top"
              />
            </View>
            <View style={styles.editModalFooter}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={closeEditCommentModal}
                disabled={submittingComment}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editSaveButton, (!editCommentContent.trim() || submittingComment) && { opacity: 0.5 }]}
                onPress={handleSaveEditComment}
                disabled={submittingComment || !editCommentContent.trim()}
              >
                {submittingComment ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.editSaveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
    fontWeight: '500',
  },

  // Hero Header
  heroHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroContent: {},
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  newPostButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  // Category Filter
  categoryFilter: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: '#1e4620',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#FFF',
  },

  // Posts List
  postsList: {
    padding: 16,
    paddingBottom: 100,
  },

  // Post Card
  postCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  postHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moreButton: {
    padding: 4,
  },
  postUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  postTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  gymTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 10,
    gap: 4,
  },
  gymTagText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  postContent: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postActionText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  // Top Comment Preview
  topCommentPreview: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topCommentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  topCommentLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e4620',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topCommentContent: {
    marginBottom: 4,
  },
  topCommentUser: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  topCommentText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  viewMoreComments: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e4620',
    marginTop: 8,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e4620',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 20,
    gap: 8,
  },
  emptyButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  // Edit Modal Styles
  editModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  editModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  editModalContent: {
    width: '100%',
  },
  editModalCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalHeaderTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
  },
  modalHeaderSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  
  // Edit Modal Styles
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  editModalHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
  },
  editModalBody: {
    flex: 1,
    padding: 20,
    backgroundColor: '#FFF',
  },
  editTitleInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
  },
  editTextArea: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
    minHeight: 150,
    textAlignVertical: 'top',
  },
  editModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFF',
    gap: 12,
  },
  editSaveButton: {
    backgroundColor: '#1e4620',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  editSaveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Form
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  formInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  formTextAreaWrapper: {
    height: 120,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  formInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  formTextArea: {
    height: '100%',
    textAlignVertical: 'top',
  },

  // Category Select
  categorySelect: {
    marginBottom: 16,
  },
  categorySelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
    gap: 6,
  },
  categorySelectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },

  // Modal Footer
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  modalPostButton: {
    flex: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalPostGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  modalPostText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

  // Detail Modal - Full Screen Rollover
  detailModalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  detailModalCard: {
    maxHeight: '95%',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  detailBackButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E293B',
  },
  detailShareButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailBody: {
    flex: 1,
  },
  detailPostCard: {
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 8,
    borderBottomColor: '#F1F5F9',
  },
  detailCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
    gap: 4,
  },
  detailCategoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailPostTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
    lineHeight: 26,
  },
  detailUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  detailAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  detailAvatarText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  detailUserInfo: {
    flex: 1,
  },
  detailMoreButton: {
    padding: 6,
  },
  detailUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  detailPostTime: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  detailGymTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 4,
  },
  detailGymTagText: {
    fontSize: 13,
    color: '#64748B',
  },
  detailPostContent: {
    fontSize: 16,
    color: '#334155',
    lineHeight: 24,
    marginBottom: 20,
  },
  detailActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailActionText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  // Replies Section
  repliesSection: {
    backgroundColor: '#FFF',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  repliesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  repliesSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  repliesSectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  replyCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e4620',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  replyAvatarText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },
  replyUserInfo: {
    flex: 1,
  },
  replyMoreButton: {
    padding: 4,
  },
  replyUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  replyTime: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 1,
  },
  replyContent: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginLeft: 42,
  },
  noReplies: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noRepliesIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  noRepliesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  noRepliesSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  replyInputContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  replyInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  replyInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    maxHeight: 100,
    paddingVertical: 6,
  },
  replySendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e4620',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replySendButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },

  // Old Comments (keep for backwards compatibility)
  commentsSection: {
    padding: 20,
  },
  commentsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  commentCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentAvatarText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 11,
  },
  commentUserInfo: {
    flex: 1,
  },
  commentUserName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  commentTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  commentContent: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginLeft: 38,
  },
  noComments: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noCommentsText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  loadingComments: {
    alignItems: 'center',
    paddingVertical: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  loadingCommentsText: {
    fontSize: 14,
    color: '#64748B',
  },

  // Comment Input
  commentInputContainer: {
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
       backgroundColor: '#FFF',
  },
  commentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  commentInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    maxHeight: 60,
    paddingVertical: 4,
  },
  commentSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e4620',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSendButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
});
