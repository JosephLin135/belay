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

  // Get current user on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  // Fetch posts from Supabase
  const fetchPosts = useCallback(async () => {
    try {
      // Fetch posts with user info, likes count, and comments count
      const { data: postsData, error: postsError } = await supabase
        .from('community_posts_with_details')
        .select('*')
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // If user is logged in, check which posts they've liked
      let likedPostIds: string[] = [];
      if (currentUserId) {
        const { data: likesData } = await supabase
          .from('community_likes')
          .select('post_id')
          .eq('user_id', currentUserId);
        
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
      
      // Fetch top comment for each post
      await fetchTopComments(postsWithLikes.map(p => p.id));
    } catch (error: any) {
      console.error('Error fetching posts:', error.message);
      Alert.alert('Error', 'Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  // Fetch top comment (most likes) for each post
  const fetchTopComments = async (postIds: string[]) => {
    if (postIds.length === 0) return;
    
    try {
      // Get all comments for these posts with like counts
      const { data: commentsData, error } = await supabase
        .from('community_comments_with_user')
        .select('*')
        .in('post_id', postIds);
      
      if (error) throw error;
      
      // Get like counts for each comment
      const { data: commentLikes } = await supabase
        .from('community_comment_likes')
        .select('comment_id');
      
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

  // Initial fetch
  useEffect(() => {
    if (currentUserId !== null) {
      fetchPosts();
    }
  }, [currentUserId, fetchPosts]);

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
    setShowPostDetailModal(true);
    fetchComments(post.id);
    setPendingScrollToComments(false);
  };

  // Open comments modal (YouTube-style popup)
  const handleOpenComments = (post: Post) => {
    setSelectedPost(post);
    setShowPostDetailModal(true);
    fetchComments(post.id);
    setPendingScrollToComments(true);
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
          <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '20' }]}>
            <Ionicons name={categoryConfig.icon as any} size={12} color={categoryConfig.color} />
            <Text style={[styles.categoryBadgeText, { color: categoryConfig.color }]}>
              {categoryConfig.label}
            </Text>
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
                <Ionicons name="chatbubbles-outline" size={48} color="#94A3B8" />
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
              <Text style={styles.modalHeaderSubtitle}>Share with the community</Text>
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

      {/* Post Detail Modal */}
      <Modal
        visible={showPostDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPostDetailModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, styles.detailModalCard]}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <TouchableOpacity 
                onPress={() => setShowPostDetailModal(false)}
                style={styles.detailBackButton}
              >
                <Ionicons name="arrow-back" size={24} color="#1E293B" />
              </TouchableOpacity>
              <Text style={styles.detailHeaderTitle}>Discussion</Text>
              <View style={{ width: 40 }} />
            </View>

            {selectedPost && (
              <>
                {/* Post Content */}
                <ScrollView style={styles.detailBody} ref={detailScrollRef}>
                  <View style={styles.detailPostCard}>
                    {/* User Info */}
                    <View style={styles.postHeader}>
                      <View style={styles.postUserInfo}>
                        {selectedPost.user_avatar ? (
                          <Image source={{ uri: selectedPost.user_avatar }} style={styles.avatarImage} />
                        ) : (
                          <View style={[styles.avatar, { backgroundColor: getCategoryConfig(selectedPost.category).color }]}>
                            <Text style={styles.avatarText}>{selectedPost.user_name[0].toUpperCase()}</Text>
                          </View>
                        )}
                        <View>
                          <Text style={styles.userName}>{selectedPost.user_name}</Text>
                          <Text style={styles.postTime}>{timeAgo(selectedPost.created_at)}</Text>
                        </View>
                      </View>
                    </View>

                    {selectedPost.gym_name && (
                      <View style={styles.gymTag}>
                        <Ionicons name="location" size={12} color="#64748B" />
                        <Text style={styles.gymTagText}>{selectedPost.gym_name}</Text>
                      </View>
                    )}

                    <Text style={styles.detailPostTitle}>{selectedPost.title}</Text>
                    <Text style={styles.detailPostContent}>{selectedPost.content}</Text>

                    {/* Actions */}
                    <View style={styles.postActions}>
                      <TouchableOpacity 
                        style={styles.postAction}
                        onPress={() => handleLikePost(selectedPost.id)}
                      >
                        <Ionicons 
                          name={selectedPost.liked_by_user ? "heart" : "heart-outline"} 
                          size={20} 
                          color={selectedPost.liked_by_user ? "#E85D75" : "#64748B"} 
                        />
                        <Text style={[styles.postActionText, selectedPost.liked_by_user && { color: '#E85D75' }]}>
                          {selectedPost.likes}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.postAction}>
                        <Ionicons name="chatbubble" size={18} color="#1e4620" />
                        <Text style={[styles.postActionText, { color: '#1e4620' }]}>
                          {comments.length} {comments.length === 1 ? 'reply' : 'replies'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Comments Section */}
                  <View
                    style={styles.commentsSection}
                    onLayout={(event) => {
                      setCommentsSectionY(event.nativeEvent.layout.y);
                    }}
                  >
                    <Text style={styles.commentsSectionTitle}>Replies</Text>
                    {loadingComments ? (
                      <View style={styles.loadingComments}>
                        <ActivityIndicator size="small" color="#1e4620" />
                        <Text style={styles.loadingCommentsText}>Loading replies...</Text>
                      </View>
                    ) : comments.map(comment => (
                      <View key={comment.id} style={styles.commentCard}>
                        <View style={styles.commentHeader}>
                          {comment.user_avatar ? (
                            <Image source={{ uri: comment.user_avatar }} style={styles.commentAvatarImage} />
                          ) : (
                            <View style={styles.commentAvatar}>
                              <Text style={styles.commentAvatarText}>
                                {comment.user_name[0].toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={styles.commentUserInfo}>
                            <Text style={styles.commentUserName}>{comment.user_name}</Text>
                            <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
                          </View>
                        </View>
                        <Text style={styles.commentContent}>{comment.content}</Text>
                      </View>
                    ))}
                    {!loadingComments && comments.length === 0 && (
                      <View style={styles.noComments}>
                        <Ionicons name="chatbubble-outline" size={32} color="#CBD5E1" />
                        <Text style={styles.noCommentsText}>No replies yet. Be the first!</Text>
                      </View>
                    )}
                  </View>
                </ScrollView>

                {/* Comment Input */}
                <View style={styles.commentInputContainer}>
                  <View style={styles.commentInputWrapper}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Add a reply"
                      placeholderTextColor="#94A3B8"
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                    />
                    <TouchableOpacity 
                      style={[
                        styles.commentSendButton,
                        !newComment.trim() && styles.commentSendButtonDisabled,
                      ]}
                      onPress={handleAddComment}
                      disabled={!newComment.trim()}
                    >
                      <Ionicons name="send" size={18} color={newComment.trim() ? '#FFF' : '#94A3B8'} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
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
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e4620',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    gap: 6,
  },
  emptyButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
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

  // Detail Modal
  detailModalCard: {
    maxHeight: '95%',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailBackButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  detailBody: {
    flex: 1,
  },
  detailPostCard: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailPostTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  detailPostContent: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 16,
  },

  // Comments
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
