import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  RoleBasedMessagingService,
  ConversationRecord,
  MessageRecord,
  UserMessagingContext,
  ConversationChannelType,
} from '../services/RoleBasedMessagingService';
import { useRoleRealtimeCommunication } from './useRoleRealtimeCommunication';

export interface UseRoleBasedMessagingProps {
  context: UserMessagingContext;
  activeConversationId?: string;
  onNewMessageReceived?: (message: MessageRecord) => void;
}

export function useRoleBasedMessaging({
  context,
  activeConversationId,
  onNewMessageReceived,
}: UseRoleBasedMessagingProps) {
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [activeMessages, setActiveMessages] = useState<MessageRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // 1. Fetch authorized conversations on load
  const loadConversations = useCallback(async () => {
    try {
      const list = await RoleBasedMessagingService.getAuthorizedConversations(context);
      setConversations(list);
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    }
  }, [context]);

  // 2. Fetch messages for active conversation
  const loadActiveMessages = useCallback(async (convId: string) => {
    setIsLoading(true);
    try {
      const msgs = await RoleBasedMessagingService.getMessages(convId, context);
      setActiveMessages(msgs);
      // Automatically mark as read
      await RoleBasedMessagingService.markMessagesAsRead(convId, context);
    } catch (err) {
      console.warn('Failed to load active messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [context]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeConversationId) {
      loadActiveMessages(activeConversationId);
    } else {
      setActiveMessages([]);
    }
  }, [activeConversationId, loadActiveMessages]);

  // 3. Realtime event listener for NEW_MESSAGE
  useRoleRealtimeCommunication({
    role: context.role,
    userId: context.userId,
    facilityId: context.facilityId,
    onEventReceived: async (event) => {
      if (event.type === 'NEW_MESSAGE') {
        console.log('Realtime NEW_MESSAGE event received for authorized role:', context.role);
        // If message belongs to active conversation, re-fetch active messages
        if (activeConversationId) {
          loadActiveMessages(activeConversationId);
        }
        // Refresh conversations list to update ordering & preview
        loadConversations();
        setUnreadCount((prev) => prev + 1);
      }
    },
  });

  // 4. Send a new message
  const sendMessage = useCallback(
    async (text: string, conversationIdToUse?: string) => {
      const targetConvId = conversationIdToUse || activeConversationId;
      if (!targetConvId) {
        throw new Error('NO_ACTIVE_CONVERSATION: Select a conversation first.');
      }

      const res = await RoleBasedMessagingService.sendMessage({
        conversationId: targetConvId,
        senderContext: context,
        message: text,
      });

      setActiveMessages((prev) => [...prev, res.message]);
      loadConversations();
      return res.message;
    },
    [activeConversationId, context, loadConversations]
  );

  // 5. Start/Get a conversation
  const startConversation = useCallback(
    async (params: {
      channelType: ConversationChannelType;
      patientId: string;
      ashaId?: string;
      phcFacilityId?: string;
      dhFacilityId?: string;
      referralId?: string;
      careEpisodeId?: string;
    }) => {
      const conv = await RoleBasedMessagingService.getOrCreateAuthorizedConversation({
        ...params,
        initiatorContext: context,
      });
      loadConversations();
      return conv;
    },
    [context, loadConversations]
  );

  return {
    conversations,
    activeMessages,
    isLoading,
    unreadCount,
    loadConversations,
    loadActiveMessages,
    sendMessage,
    startConversation,
  };
}
