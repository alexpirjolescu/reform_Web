
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activities": {
                  Row: {
                    "body": string,"category": Database["public"]['Enums']["activity_category"],"cover_path": string | null,"created_at": string,"created_by": string | null,"ends_at": string | null,"id": string,"is_demo": boolean,"location": string,"photo_consent_confirmed": boolean,"publish_at": string,"starts_at": string,"status": string,"summary": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "body"?: string,"category": Database["public"]['Enums']["activity_category"],"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"is_demo"?: boolean,"location"?: string,"photo_consent_confirmed"?: boolean,"publish_at"?: string,"starts_at": string,"status"?: string,"summary"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"category"?: Database["public"]['Enums']["activity_category"],"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"is_demo"?: boolean,"location"?: string,"photo_consent_confirmed"?: boolean,"publish_at"?: string,"starts_at"?: string,"status"?: string,"summary"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"activity_media": {
                  Row: {
                    "activity_id": string,"caption": string,"created_at": string,"id": string,"kind": string,"mime_type": string | null,"path": string | null,"position": number,"provider": string | null,"size_bytes": number | null,"title": string,"url": string | null
                  }
                  Insert: {
                    "activity_id": string,"caption"?: string,"created_at"?: string,"id"?: string,"kind": string,"mime_type"?: string | null,"path"?: string | null,"position"?: number,"provider"?: string | null,"size_bytes"?: number | null,"title"?: string,"url"?: string | null
                  }
                  Update: {
                    "activity_id"?: string,"caption"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"mime_type"?: string | null,"path"?: string | null,"position"?: number,"provider"?: string | null,"size_bytes"?: number | null,"title"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_media_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    }
                  ]
                },"activity_schools": {
                  Row: {
                    "activity_id": string,"school_id": string
                  }
                  Insert: {
                    "activity_id": string,"school_id": string
                  }
                  Update: {
                    "activity_id"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_schools_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_schools_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"answers": {
                  Row: {
                    "attempt_id": string,"choice_ids": (string)[],"id": string,"is_correct": boolean | null,"points_awarded": number | null,"question_id": string,"text_answer": string
                  }
                  Insert: {
                    "attempt_id": string,"choice_ids"?: (string)[],"id"?: string,"is_correct"?: boolean | null,"points_awarded"?: number | null,"question_id": string,"text_answer"?: string
                  }
                  Update: {
                    "attempt_id"?: string,"choice_ids"?: (string)[],"id"?: string,"is_correct"?: boolean | null,"points_awarded"?: number | null,"question_id"?: string,"text_answer"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "answers_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "attempts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"assessment_schools": {
                  Row: {
                    "assessment_id": string,"school_id": string
                  }
                  Insert: {
                    "assessment_id": string,"school_id": string
                  }
                  Update: {
                    "assessment_id"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessment_schools_assessment_id_fkey"
      columns: ["assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessment_schools_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"assessments": {
                  Row: {
                    "activity_id": string | null,"allow_late": boolean,"closes_at": string,"created_at": string,"created_by": string | null,"id": string,"instructions": string,"is_demo": boolean,"kind": Database["public"]['Enums']["assessment_kind"],"max_attempts": number,"opens_at": string,"show_answers": string,"status": string,"title": string
                  }
                  Insert: {
                    "activity_id"?: string | null,"allow_late"?: boolean,"closes_at": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"instructions"?: string,"is_demo"?: boolean,"kind": Database["public"]['Enums']["assessment_kind"],"max_attempts"?: number,"opens_at"?: string,"show_answers"?: string,"status"?: string,"title": string
                  }
                  Update: {
                    "activity_id"?: string | null,"allow_late"?: boolean,"closes_at"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"instructions"?: string,"is_demo"?: boolean,"kind"?: Database["public"]['Enums']["assessment_kind"],"max_attempts"?: number,"opens_at"?: string,"show_answers"?: string,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assessments_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assessments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"attempts": {
                  Row: {
                    "assessment_id": string,"attempt_number": number,"auto_score": number | null,"feedback": string,"final_score": number | null,"id": string,"is_late": boolean,"link_response": string,"max_score": number | null,"reviewed_at": string | null,"reviewed_by": string | null,"started_at": string,"status": string,"student_id": string,"submitted_at": string | null,"text_response": string
                  }
                  Insert: {
                    "assessment_id": string,"attempt_number"?: number,"auto_score"?: number | null,"feedback"?: string,"final_score"?: number | null,"id"?: string,"is_late"?: boolean,"link_response"?: string,"max_score"?: number | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"started_at"?: string,"status"?: string,"student_id": string,"submitted_at"?: string | null,"text_response"?: string
                  }
                  Update: {
                    "assessment_id"?: string,"attempt_number"?: number,"auto_score"?: number | null,"feedback"?: string,"final_score"?: number | null,"id"?: string,"is_late"?: boolean,"link_response"?: string,"max_score"?: number | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"started_at"?: string,"status"?: string,"student_id"?: string,"submitted_at"?: string | null,"text_response"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attempts_assessment_id_fkey"
      columns: ["assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempts_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempts_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": number,"target_id": string | null,"target_type": string | null
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"board_columns": {
                  Row: {
                    "board_id": string,"created_at": string,"id": string,"is_done": boolean,"name": string,"position": number
                  }
                  Insert: {
                    "board_id": string,"created_at"?: string,"id"?: string,"is_done"?: boolean,"name": string,"position"?: number
                  }
                  Update: {
                    "board_id"?: string,"created_at"?: string,"id"?: string,"is_done"?: boolean,"name"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "board_columns_board_id_fkey"
      columns: ["board_id"]
isOneToOne: false
      referencedRelation: "boards"
      referencedColumns: ["id"]
    }
                  ]
                },"boards": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"description": string,"due_date": string | null,"id": string,"is_demo": boolean,"name": string,"school_id": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"school_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_date"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"school_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "boards_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "boards_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"card_assignees": {
                  Row: {
                    "card_id": string,"profile_id": string
                  }
                  Insert: {
                    "card_id": string,"profile_id": string
                  }
                  Update: {
                    "card_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_assignees_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_assignees_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"card_attachments": {
                  Row: {
                    "card_id": string,"created_at": string,"created_by": string | null,"file_id": string,"id": string
                  }
                  Insert: {
                    "card_id": string,"created_at"?: string,"created_by"?: string | null,"file_id": string,"id"?: string
                  }
                  Update: {
                    "card_id"?: string,"created_at"?: string,"created_by"?: string | null,"file_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_attachments_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_attachments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_attachments_file_id_fkey"
      columns: ["file_id"]
isOneToOne: false
      referencedRelation: "library_files"
      referencedColumns: ["id"]
    }
                  ]
                },"card_comments": {
                  Row: {
                    "author_id": string,"body": string,"card_id": string,"created_at": string,"id": string
                  }
                  Insert: {
                    "author_id"?: string,"body": string,"card_id": string,"created_at"?: string,"id"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"card_id"?: string,"created_at"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_comments_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                },"card_events": {
                  Row: {
                    "actor_id": string | null,"card_id": string,"created_at": string,"details": NonNullable<Json>,"id": number,"kind": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"card_id": string,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"kind": string
                  }
                  Update: {
                    "actor_id"?: string | null,"card_id"?: string,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"kind"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "card_events_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                },"card_labels": {
                  Row: {
                    "card_id": string,"color": string,"id": string,"name": string
                  }
                  Insert: {
                    "card_id": string,"color"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "card_id"?: string,"color"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "card_labels_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                },"cards": {
                  Row: {
                    "board_id": string,"column_id": string,"created_at": string,"created_by": string | null,"description": string,"due_date": string | null,"id": string,"position": number,"title": string,"updated_at": string
                  }
                  Insert: {
                    "board_id": string,"column_id": string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_date"?: string | null,"id"?: string,"position"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "board_id"?: string,"column_id"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_date"?: string | null,"id"?: string,"position"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cards_board_id_fkey"
      columns: ["board_id"]
isOneToOne: false
      referencedRelation: "boards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cards_column_id_fkey"
      columns: ["column_id"]
isOneToOne: false
      referencedRelation: "board_columns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cards_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"checklist_items": {
                  Row: {
                    "card_id": string,"done": boolean,"id": string,"label": string,"position": number
                  }
                  Insert: {
                    "card_id": string,"done"?: boolean,"id"?: string,"label": string,"position"?: number
                  }
                  Update: {
                    "card_id"?: string,"done"?: boolean,"id"?: string,"label"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklist_items_card_id_fkey"
      columns: ["card_id"]
isOneToOne: false
      referencedRelation: "cards"
      referencedColumns: ["id"]
    }
                  ]
                },"choice_keys": {
                  Row: {
                    "choice_id": string,"is_correct": boolean
                  }
                  Insert: {
                    "choice_id": string,"is_correct"?: boolean
                  }
                  Update: {
                    "choice_id"?: string,"is_correct"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "choice_keys_choice_id_fkey"
      columns: ["choice_id"]
isOneToOne: true
      referencedRelation: "question_choices"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_participants": {
                  Row: {
                    "conversation_id": string,"last_read_at": string,"profile_id": string
                  }
                  Insert: {
                    "conversation_id": string,"last_read_at"?: string,"profile_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"last_read_at"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_participants_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_participants_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"id": string,"last_message_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"last_message_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"last_message_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"library_files": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"description": string,"external_url": string | null,"folder_id": string,"id": string,"is_demo": boolean,"mime_type": string,"name": string,"size_bytes": number,"storage_path": string | null,"tags": (string)[],"uploaded_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"external_url"?: string | null,"folder_id": string,"id"?: string,"is_demo"?: boolean,"mime_type"?: string,"name": string,"size_bytes"?: number,"storage_path"?: string | null,"tags"?: (string)[],"uploaded_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"description"?: string,"external_url"?: string | null,"folder_id"?: string,"id"?: string,"is_demo"?: boolean,"mime_type"?: string,"name"?: string,"size_bytes"?: number,"storage_path"?: string | null,"tags"?: (string)[],"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "library_files_folder_id_fkey"
      columns: ["folder_id"]
isOneToOne: false
      referencedRelation: "library_folders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_files_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"library_folders": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_demo": boolean,"name": string,"school_id": string | null,"space": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_demo"?: boolean,"name": string,"school_id"?: string | null,"space": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_demo"?: boolean,"name"?: string,"school_id"?: string | null,"space"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "library_folders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "library_folders_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"message_reports": {
                  Row: {
                    "conversation_id": string,"created_at": string,"id": string,"message_id": string | null,"reason": string,"reporter_id": string,"reviewed_at": string | null,"reviewed_by": string | null,"status": string
                  }
                  Insert: {
                    "conversation_id": string,"created_at"?: string,"id"?: string,"message_id"?: string | null,"reason"?: string,"reporter_id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: string,"id"?: string,"message_id"?: string | null,"reason"?: string,"reporter_id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "message_reports_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_reports_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "message_reports_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "attachment_name": string | null,"attachment_path": string | null,"body": string,"conversation_id": string,"created_at": string,"deleted_at": string | null,"edited_at": string | null,"id": string,"sender_id": string
                  }
                  Insert: {
                    "attachment_name"?: string | null,"attachment_path"?: string | null,"body"?: string,"conversation_id": string,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"sender_id"?: string
                  }
                  Update: {
                    "attachment_name"?: string | null,"attachment_path"?: string | null,"body"?: string,"conversation_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"newsletter_subscribers": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"locale": string
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"locale"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"locale"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"deactivated_at": string | null,"full_name": string,"graduation_year": number | null,"id": string,"locale": string,"role": Database["public"]['Enums']["app_role"],"school_id": string | null,"theme": string,"updated_at": string
                  }
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"full_name"?: string,"graduation_year"?: number | null,"id": string,"locale"?: string,"role"?: Database["public"]['Enums']["app_role"],"school_id"?: string | null,"theme"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"deactivated_at"?: string | null,"full_name"?: string,"graduation_year"?: number | null,"id"?: string,"locale"?: string,"role"?: Database["public"]['Enums']["app_role"],"school_id"?: string | null,"theme"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_school_id_fkey"
      columns: ["school_id"]
isOneToOne: false
      referencedRelation: "schools"
      referencedColumns: ["id"]
    }
                  ]
                },"question_choices": {
                  Row: {
                    "id": string,"label": string,"position": number,"question_id": string
                  }
                  Insert: {
                    "id"?: string,"label": string,"position"?: number,"question_id": string
                  }
                  Update: {
                    "id"?: string,"label"?: string,"position"?: number,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_choices_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "questions"
      referencedColumns: ["id"]
    }
                  ]
                },"questions": {
                  Row: {
                    "assessment_id": string,"id": string,"kind": Database["public"]['Enums']["question_kind"],"points": number,"position": number,"prompt": string
                  }
                  Insert: {
                    "assessment_id": string,"id"?: string,"kind": Database["public"]['Enums']["question_kind"],"points"?: number,"position"?: number,"prompt": string
                  }
                  Update: {
                    "assessment_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["question_kind"],"points"?: number,"position"?: number,"prompt"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "questions_assessment_id_fkey"
      columns: ["assessment_id"]
isOneToOne: false
      referencedRelation: "assessments"
      referencedColumns: ["id"]
    }
                  ]
                },"schools": {
                  Row: {
                    "city": string | null,"created_at": string,"id": string,"name": string
                  }
                  Insert: {
                    "city"?: string | null,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "city"?: string | null,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"submission_files": {
                  Row: {
                    "attempt_id": string,"created_at": string,"id": string,"mime_type": string,"name": string,"size_bytes": number,"storage_path": string
                  }
                  Insert: {
                    "attempt_id": string,"created_at"?: string,"id"?: string,"mime_type"?: string,"name": string,"size_bytes"?: number,"storage_path": string
                  }
                  Update: {
                    "attempt_id"?: string,"created_at"?: string,"id"?: string,"mime_type"?: string,"name"?: string,"size_bytes"?: number,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "submission_files_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "attempts"
      referencedColumns: ["id"]
    }
                  ]
                },"user_blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "activity_is_public":
{ Args: { "target": string }; Returns: boolean
                           },
"admin_read_reported_conversation":
{ Args: { "target_report": string }; Returns: {
              "attachment_name": string,"body": string,"created_at": string,"deleted_at": string,"id": string,"sender_id": string
            }[]
                           },
"attempt_review":
{ Args: { "target_attempt": string }; Returns: {
              "correct_choice_ids": (string)[],"is_correct": boolean,"points_awarded": number,"question_id": string
            }[]
                           },
"can_access_board":
{ Args: { "target": string }; Returns: boolean
                           },
"can_access_card":
{ Args: { "target": string }; Returns: boolean
                           },
"can_access_school":
{ Args: { "target_school": string }; Returns: boolean
                           },
"can_manage_boards":
{ Args: { "target_school": string }; Returns: boolean
                           },
"can_message":
{ Args: { "target": string }; Returns: boolean
                           },
"can_post":
{ Args: { "target_conversation": string }; Returns: boolean
                           },
"can_read_folder":
{ Args: { "target": string }; Returns: boolean
                           },
"can_see_assessment":
{ Args: { "target": string }; Returns: boolean
                           },
"can_see_questions":
{ Args: { "target": string }; Returns: boolean
                           },
"can_write_folder":
{ Args: { "target": string }; Returns: boolean
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"current_school_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_participant":
{ Args: { "target": string }; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_conversation_read":
{ Args: { "target": string }; Returns: undefined
                           },
"owns_attempt":
{ Args: { "target": string }; Returns: boolean
                           },
"public_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"remove_demo_content":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"review_attempt":
{ Args: { "feedback_text": string,"open_points": Json,"score": number,"target_attempt": string }; Returns: undefined
                           },
"save_activity":
{ Args: { "payload": Json }; Returns: string
                           },
"save_answer":
{ Args: { "answer_text": string,"selected": (string)[],"target_attempt": string,"target_question": string }; Returns: undefined
                           },
"save_assessment":
{ Args: { "payload": Json }; Returns: string
                           },
"save_attempt_response":
{ Args: { "response_link": string,"response_text": string,"target_attempt": string }; Returns: undefined
                           },
"start_attempt":
{ Args: { "target": string }; Returns: string
                           },
"start_conversation":
{ Args: { "target": string }; Returns: string
                           },
"submit_attempt":
{ Args: { "target_attempt": string }; Returns: undefined
                           },
"subscribe_newsletter":
{ Args: { "subscriber_email": string,"subscriber_locale"?: string }; Returns: undefined
                           },
"try_uuid":
{ Args: { "value": string }; Returns: string
                           },
"unread_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "conversation_id": string,"unread": number
            }[]
                           }
          }
          Enums: {
            "activity_category": "workshop"|"meeting"|"event"|"showcase","app_role": "student"|"core_lead"|"staff"|"admin","assessment_kind": "quiz"|"assignment","question_kind": "single"|"multiple"|"true_false"|"open"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "activity_category": ["workshop", "meeting", "event", "showcase"],"app_role": ["student", "core_lead", "staff", "admin"],"assessment_kind": ["quiz", "assignment"],"question_kind": ["single", "multiple", "true_false", "open"]
          }
        }
} as const
