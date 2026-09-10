import { supabase } from '../supabaseClient';
import {
  RealtimeCommunicationService,
  RealtimeRole,
  RealtimeHealthcareEvent,
} from './RealtimeCommunicationService';

export type ConversationChannelType =
  | 'PATIENT_ASHA'
  | 'PATIENT_PHC'
  | 'ASHA_PHC'
  | 'PHC_DISTRICT_HOSPITAL'
  | 'DISTRICT_HOSPITAL_PATIENT';

export interface ConversationRecord {
  id: string;
  channel_type: ConversationChannelType;
  patient_id: string;
  asha_id?: string | null;
  phc_facility_id?: string | null;
  dh_facility_id?: string | null;
  referral_id?: string | null;
  care_episode_id?: string | null;
  last_message_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: RealtimeRole;
  recipient_id?: string | null;
  patient_id?: string | null;
  message: string;
  created_at: string;
  read_at?: string | null;
}

export interface UserMessagingContext {
  userId: string;
  role: RealtimeRole;
  facilityId?: string;
  assignedPatientIds?: string[];
  assignedAshaIds?: string[];
}

export interface CreateConversationParams {
  channelType: ConversationChannelType;
  patientId: string;
  ashaId?: string;
  phcFacilityId?: string;
  dhFacilityId?: string;
  referralId?: string;
  careEpisodeId?: string;
  initiatorContext: UserMessagingContext;
}

export interface SendMessageParams {
  conversationId: string;
  senderContext: UserMessagingContext;
  message: string;
  recipientId?: string;
}

export class RoleBasedMessagingService {
  /**
   * 1. Validate Channel Authorization & Guardrails
   * Strictly prevents open/unrestricted messaging.
   */
  static validateChannelAuthorization(params: CreateConversationParams): void {
    const { channelType, patientId, ashaId, phcFacilityId, dhFacilityId, referralId, initiatorContext } = params;

    if (!patientId) {
      throw new Error('VALIDATION_ERROR: patientId is required for all healthcare communication channels.');
    }

    switch (channelType) {
      case 'PATIENT_ASHA': {
        // Only PATIENT and ASHA
        if (initiatorContext.role !== 'PATIENT' && initiatorContext.role !== 'ASHA') {
          throw new Error('SECURITY_ERROR: Only assigned PATIENT or ASHA can access PATIENT_ASHA channel.');
        }
        if (initiatorContext.role === 'PATIENT' && initiatorContext.userId !== patientId) {
          throw new Error('SECURITY_ERROR: Patient cannot message on behalf of another patient.');
        }
        if (initiatorContext.role === 'ASHA') {
          if (!ashaId || initiatorContext.userId !== ashaId) {
            throw new Error('SECURITY_ERROR: ASHA ID mismatch with authenticated session.');
          }
          if (initiatorContext.assignedPatientIds && !initiatorContext.assignedPatientIds.includes(patientId)) {
            throw new Error('SECURITY_ERROR: ASHA cannot message unassigned patients.');
          }
        }
        break;
      }

      case 'PATIENT_PHC': {
        if (initiatorContext.role !== 'PATIENT' && initiatorContext.role !== 'PHC') {
          throw new Error('SECURITY_ERROR: Only registered PATIENT or PHC staff can access PATIENT_PHC channel.');
        }
        if (initiatorContext.role === 'PATIENT' && initiatorContext.userId !== patientId) {
          throw new Error('SECURITY_ERROR: Patient cannot access another patient PHC conversation.');
        }
        if (initiatorContext.role === 'PHC') {
          if (!phcFacilityId || initiatorContext.facilityId !== phcFacilityId) {
            throw new Error('SECURITY_ERROR: PHC doctor cannot access conversations of another PHC facility.');
          }
        }
        break;
      }

      case 'ASHA_PHC': {
        if (initiatorContext.role !== 'ASHA' && initiatorContext.role !== 'PHC') {
          throw new Error('SECURITY_ERROR: Only authorized ASHA or supervising PHC can access ASHA_PHC channel.');
        }
        if (initiatorContext.role === 'ASHA') {
          if (!ashaId || initiatorContext.userId !== ashaId) {
            throw new Error('SECURITY_ERROR: ASHA ID mismatch.');
          }
          if (initiatorContext.assignedPatientIds && !initiatorContext.assignedPatientIds.includes(patientId)) {
            throw new Error('SECURITY_ERROR: ASHA can only coordinate with PHC for assigned patients.');
          }
        }
        if (initiatorContext.role === 'PHC') {
          if (!phcFacilityId || initiatorContext.facilityId !== phcFacilityId) {
            throw new Error('SECURITY_ERROR: PHC cannot access communications for unrelated facilities.');
          }
        }
        break;
      }

      case 'PHC_DISTRICT_HOSPITAL': {
        if (initiatorContext.role !== 'PHC' && initiatorContext.role !== 'DISTRICT_HOSPITAL') {
          throw new Error('SECURITY_ERROR: Only referring PHC and destination District Hospital can access PHC_DISTRICT_HOSPITAL channel.');
        }
        if (!referralId) {
          throw new Error('SECURITY_ERROR: PHC and District Hospital communication requires an active referral relationship.');
        }
        if (initiatorContext.role === 'PHC' && initiatorContext.facilityId !== phcFacilityId) {
          throw new Error('SECURITY_ERROR: PHC doctor cannot access another PHC referral channel.');
        }
        if (initiatorContext.role === 'DISTRICT_HOSPITAL' && initiatorContext.facilityId !== dhFacilityId) {
          throw new Error('SECURITY_ERROR: District Hospital staff cannot access referrals designated for another hospital.');
        }
        break;
      }

      case 'DISTRICT_HOSPITAL_PATIENT': {
        if (initiatorContext.role !== 'DISTRICT_HOSPITAL' && initiatorContext.role !== 'PATIENT') {
          throw new Error('SECURITY_ERROR: Only treating District Hospital or patient can access DISTRICT_HOSPITAL_PATIENT channel.');
        }
        if (!referralId && !params.careEpisodeId) {
          throw new Error('SECURITY_ERROR: Hospital communication with patient requires an active referral or care episode.');
        }
        if (initiatorContext.role === 'PATIENT' && initiatorContext.userId !== patientId) {
          throw new Error('SECURITY_ERROR: Patient cannot access hospital conversation of another patient.');
        }
        if (initiatorContext.role === 'DISTRICT_HOSPITAL' && initiatorContext.facilityId !== dhFacilityId) {
          throw new Error('SECURITY_ERROR: District Hospital cannot message patients outside its care episode.');
        }
        break;
      }

      default:
        throw new Error(`SECURITY_ERROR: Invalid conversation channel type: ${channelType}`);
    }
  }

  /**
   * 2. Verify Conversation Access for an Existing Conversation
   */
  static isUserAuthorizedForConversation(
    conversation: ConversationRecord,
    context: UserMessagingContext
  ): boolean {
    if (context.role === 'PATIENT') {
      return conversation.patient_id === context.userId;
    }

    if (context.role === 'ASHA') {
      if (conversation.asha_id && conversation.asha_id === context.userId) {
        return true;
      }
      if (context.assignedPatientIds && context.assignedPatientIds.includes(conversation.patient_id)) {
        return true;
      }
      return false;
    }

    if (context.role === 'PHC') {
      return Boolean(conversation.phc_facility_id && conversation.phc_facility_id === context.facilityId);
    }

    if (context.role === 'DISTRICT_HOSPITAL') {
      return Boolean(conversation.dh_facility_id && conversation.dh_facility_id === context.facilityId);
    }

    return false;
  }

  /**
   * 3. Get or Create an Authorized Healthcare Conversation
   */
  static async getOrCreateAuthorizedConversation(
    params: CreateConversationParams
  ): Promise<ConversationRecord> {
    // 1. Verify channel rules
    this.validateChannelAuthorization(params);

    // 2. Look up existing conversation
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('channel_type', params.channelType)
      .eq('patient_id', params.patientId);

    if (params.ashaId) query = query.eq('asha_id', params.ashaId);
    if (params.phcFacilityId) query = query.eq('phc_facility_id', params.phcFacilityId);
    if (params.dhFacilityId) query = query.eq('dh_facility_id', params.dhFacilityId);
    if (params.referralId) query = query.eq('referral_id', params.referralId);

    const { data: existing, error: searchErr } = await query.maybeSingle();

    if (existing && !searchErr) {
      if (!this.isUserAuthorizedForConversation(existing, params.initiatorContext)) {
        throw new Error('SECURITY_ERROR: Access denied to conversation.');
      }
      return existing;
    }

    // 3. Insert new authorized conversation
    const { data: created, error: insertErr } = await supabase
      .from('conversations')
      .insert({
        channel_type: params.channelType,
        patient_id: params.patientId,
        asha_id: params.ashaId || null,
        phc_facility_id: params.phcFacilityId || null,
        dh_facility_id: params.dhFacilityId || null,
        referral_id: params.referralId || null,
        care_episode_id: params.careEpisodeId || null,
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr || !created) {
      console.error('Failed to create authorized conversation:', insertErr);
      throw new Error(`DB_ERROR: ${insertErr?.message || 'Could not create conversation'}`);
    }

    return created;
  }

  /**
   * 4. Send Message & Broadcast Realtime Notification
   */
  static async sendMessage(params: SendMessageParams): Promise<{
    message: MessageRecord;
    realtimeEvents: RealtimeHealthcareEvent[];
  }> {
    const { conversationId, senderContext, message } = params;

    if (!message || message.trim().length === 0) {
      throw new Error('VALIDATION_ERROR: Message text cannot be empty.');
    }

    // 1. Fetch conversation and verify authorization
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv) {
      throw new Error('SECURITY_ERROR: Conversation not found or access denied.');
    }

    if (!this.isUserAuthorizedForConversation(conv, senderContext)) {
      throw new Error('SECURITY_ERROR: Sender is not an authorized participant in this conversation.');
    }

    // 2. Persist message in database
    const { data: savedMessage, error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderContext.userId,
        sender_role: senderContext.role,
        recipient_id: params.recipientId || null,
        patient_id: conv.patient_id,
        message: message.trim(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (msgErr || !savedMessage) {
      console.error('Failed to insert message:', msgErr);
      throw new Error(`DB_ERROR: ${msgErr?.message || 'Failed to save message'}`);
    }

    // 3. Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: savedMessage.created_at })
      .eq('id', conversationId);

    // 4. Determine authorized recipients and broadcast targeted realtime event(s)
    const realtimeEvents: RealtimeHealthcareEvent[] = [];

    // Broadcast to relevant role participant(s)
    if (conv.channel_type === 'PATIENT_ASHA') {
      const isSenderPatient = senderContext.role === 'PATIENT';
      const recipientType = isSenderPatient ? 'ASHA' : 'PATIENT';
      const recipientUserId = isSenderPatient ? conv.asha_id || undefined : conv.patient_id;

      const evt = await RealtimeCommunicationService.publishEvent({
        type: 'NEW_MESSAGE',
        actorId: senderContext.userId,
        actorRole: senderContext.role,
        patientId: conv.patient_id,
        relatedEntityId: savedMessage.id,
        relatedEntityType: 'message',
        recipientType,
        recipientUserId,
      });
      realtimeEvents.push(evt);
    } else if (conv.channel_type === 'PATIENT_PHC') {
      const isSenderPatient = senderContext.role === 'PATIENT';
      const recipientType = isSenderPatient ? 'PHC' : 'PATIENT';

      const evt = await RealtimeCommunicationService.publishEvent({
        type: 'NEW_MESSAGE',
        actorId: senderContext.userId,
        actorRole: senderContext.role,
        patientId: conv.patient_id,
        relatedEntityId: savedMessage.id,
        relatedEntityType: 'message',
        recipientType,
        recipientUserId: isSenderPatient ? undefined : conv.patient_id,
        recipientFacilityId: isSenderPatient ? conv.phc_facility_id || undefined : undefined,
      });
      realtimeEvents.push(evt);
    } else if (conv.channel_type === 'ASHA_PHC') {
      const isSenderAsha = senderContext.role === 'ASHA';
      const recipientType = isSenderAsha ? 'PHC' : 'ASHA';

      const evt = await RealtimeCommunicationService.publishEvent({
        type: 'NEW_MESSAGE',
        actorId: senderContext.userId,
        actorRole: senderContext.role,
        patientId: conv.patient_id,
        relatedEntityId: savedMessage.id,
        relatedEntityType: 'message',
        recipientType,
        recipientUserId: isSenderAsha ? undefined : conv.asha_id || undefined,
        recipientFacilityId: isSenderAsha ? conv.phc_facility_id || undefined : undefined,
      });
      realtimeEvents.push(evt);
    } else if (conv.channel_type === 'PHC_DISTRICT_HOSPITAL') {
      const isSenderPhc = senderContext.role === 'PHC';
      const recipientType = isSenderPhc ? 'DISTRICT_HOSPITAL' : 'PHC';

      const evt = await RealtimeCommunicationService.publishEvent({
        type: 'NEW_MESSAGE',
        actorId: senderContext.userId,
        actorRole: senderContext.role,
        patientId: conv.patient_id,
        relatedEntityId: savedMessage.id,
        relatedEntityType: 'message',
        recipientType,
        recipientFacilityId: isSenderPhc ? conv.dh_facility_id || undefined : conv.phc_facility_id || undefined,
      });
      realtimeEvents.push(evt);
    } else if (conv.channel_type === 'DISTRICT_HOSPITAL_PATIENT') {
      const isSenderDh = senderContext.role === 'DISTRICT_HOSPITAL';
      const recipientType = isSenderDh ? 'PATIENT' : 'DISTRICT_HOSPITAL';

      const evt = await RealtimeCommunicationService.publishEvent({
        type: 'NEW_MESSAGE',
        actorId: senderContext.userId,
        actorRole: senderContext.role,
        patientId: conv.patient_id,
        relatedEntityId: savedMessage.id,
        relatedEntityType: 'message',
        recipientType,
        recipientUserId: isSenderDh ? conv.patient_id : undefined,
        recipientFacilityId: isSenderDh ? undefined : conv.dh_facility_id || undefined,
      });
      realtimeEvents.push(evt);
    }

    return { message: savedMessage, realtimeEvents };
  }

  /**
   * 5. Fetch Messages in Conversation (Strictly Authorized)
   */
  static async getMessages(
    conversationId: string,
    context: UserMessagingContext
  ): Promise<MessageRecord[]> {
    // 1. Fetch conversation first to verify permission
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv) {
      throw new Error('SECURITY_ERROR: Conversation not found or access denied.');
    }

    if (!this.isUserAuthorizedForConversation(conv, context)) {
      throw new Error('SECURITY_ERROR: Access denied to conversation messages.');
    }

    // 2. Fetch messages ordered chronologically
    const { data: messages, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgErr) {
      console.error('Failed to fetch messages:', msgErr);
      throw new Error(`DB_ERROR: ${msgErr.message}`);
    }

    return messages || [];
  }

  /**
   * 6. Mark Messages as Read
   */
  static async markMessagesAsRead(
    conversationId: string,
    context: UserMessagingContext
  ): Promise<{ updatedCount: number }> {
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv || !this.isUserAuthorizedForConversation(conv, context)) {
      throw new Error('SECURITY_ERROR: Cannot mark messages as read in unauthorized conversation.');
    }

    const { data, error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', context.userId)
      .is('read_at', null)
      .select();

    if (error) {
      console.error('Failed to mark messages as read:', error);
      throw new Error(`DB_ERROR: ${error.message}`);
    }

    return { updatedCount: data?.length || 0 };
  }

  /**
   * 7. Fetch Authorized Conversations for User
   */
  static async getAuthorizedConversations(
    context: UserMessagingContext
  ): Promise<ConversationRecord[]> {
    let query = supabase.from('conversations').select('*');

    if (context.role === 'PATIENT') {
      query = query.eq('patient_id', context.userId);
    } else if (context.role === 'ASHA') {
      query = query.or(`asha_id.eq.${context.userId},patient_id.in.(${context.assignedPatientIds?.join(',') || 'none'})`);
    } else if (context.role === 'PHC') {
      if (!context.facilityId) return [];
      query = query.eq('phc_facility_id', context.facilityId);
    } else if (context.role === 'DISTRICT_HOSPITAL') {
      if (!context.facilityId) return [];
      query = query.eq('dh_facility_id', context.facilityId);
    }

    const { data: convs, error } = await query.order('last_message_at', { ascending: false });
    if (error) {
      console.error('Failed to fetch authorized conversations:', error);
      return [];
    }

    return convs || [];
  }
}
