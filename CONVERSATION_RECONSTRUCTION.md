# Conversation Storage Logic Reconstruction

## Overview
Reconstructed the conversation storage logic to support multiple conversations between a user and an AI character, sorted by time. Users can now start new conversations, and all past conversations are saved and can be continued later.

## Key Changes

### 1. Database Migration
**File:** `supabase/migrations/20251111000000_remove_conversation_unique_constraint.sql`

- **Removed** the `UNIQUE (user_id, ai_role_id, title)` constraint from the `conversations` table
- This allows multiple conversations between the same user and AI character
- Added an index `idx_conversations_user_ai_updated` for better query performance when fetching conversations sorted by time

### 2. Chat.tsx Updates

#### New State Variables
- `isNewConversation`: Tracks if this is a brand new conversation
- `conversationCreatedRef`: Prevents duplicate conversation creation
- Added `useSearchParams` to handle URL query parameters

#### Conversation Initialization Logic
**Before:** Automatically found or created a conversation when entering the chat page
**After:** 
- If `conversation` query parameter exists → Load existing conversation
- If no parameter → Wait to create conversation until first message is sent
- Empty chat interface shown initially for new conversations

#### Message Sending Logic
**Before:** Required conversation to exist before sending messages
**After:**
- On first message send, creates a new conversation with timestamp-based title (e.g., "11/11 02:30 PM 对话")
- Subsequent messages use the existing conversation ID
- If user navigates away without sending any message, no conversation is created (saves database space)

#### Navigation
- Back button now navigates to `/you` instead of `/friends`

### 3. You.tsx Updates

#### New Function
- `handleConversationClick(conversationId)`: Navigates to chat with specific conversation ID

#### Conversation Display
- All conversation items are now clickable
- Added hover effects (opacity change and shadow transition)
- Clicking a conversation navigates to `/chat/{roleId}?conversation={conversationId}`

#### User Experience
- "开始聊天" button → Creates a new empty conversation
- Clicking on past conversation → Continues that specific conversation
- All conversations are sorted by `created_at` descending (newest first)

## User Flow

### Starting a New Conversation
1. User clicks "开始聊天" button on You page
2. Navigates to `/chat/{roleId}` (no conversation parameter)
3. Empty chat interface appears
4. If user sends a message → New conversation created with timestamp title
5. If user goes back without sending → No conversation saved

### Continuing an Existing Conversation
1. User clicks on a past conversation in the history
2. Navigates to `/chat/{roleId}?conversation={conversationId}`
3. All previous messages load
4. User can continue chatting in the same conversation thread

## Benefits

1. **Multiple Conversations**: Users can have multiple distinct conversation threads with the same AI character
2. **Clean UI**: Empty conversations (no messages sent) are not saved to the database
3. **Easy Navigation**: Click on any past conversation to continue where you left off
4. **Timestamp Tracking**: Each conversation has a clear timestamp showing when it started
5. **Better Organization**: Conversations sorted by time make it easy to find recent chats

## Technical Improvements

1. **Lazy Conversation Creation**: Conversations only created when needed (first message)
2. **URL-based Navigation**: Conversation ID in query params allows direct linking and browser history
3. **Performance**: Index added for faster conversation queries
4. **Scalability**: No unique constraint means unlimited conversations per user-AI pair
