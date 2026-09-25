
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "auto_assignments": {
                  Row: {
                    "assigned_at": string,"auto_id": string,"driver_id": string,"id": string,"revoked_at": string | null
                  }
                  Insert: {
                    "assigned_at"?: string,"auto_id": string,"driver_id": string,"id"?: string,"revoked_at"?: string | null
                  }
                  Update: {
                    "assigned_at"?: string,"auto_id"?: string,"driver_id"?: string,"id"?: string,"revoked_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "auto_assignments_auto_id_fkey"
      columns: ["auto_id"]
isOneToOne: false
      referencedRelation: "autos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "auto_assignments_driver_id_fkey"
      columns: ["driver_id"]
isOneToOne: false
      referencedRelation: "drivers"
      referencedColumns: ["id"]
    }
                  ]
                },"autos": {
                  Row: {
                    "capacity": number,"colour": string | null,"created_at": string,"id": string,"model": string | null,"registration_number": string,"status": Database["public"]['Enums']["auto_status"],"updated_at": string
                  }
                  Insert: {
                    "capacity": number,"colour"?: string | null,"created_at"?: string,"id"?: string,"model"?: string | null,"registration_number": string,"status"?: Database["public"]['Enums']["auto_status"],"updated_at"?: string
                  }
                  Update: {
                    "capacity"?: number,"colour"?: string | null,"created_at"?: string,"id"?: string,"model"?: string | null,"registration_number"?: string,"status"?: Database["public"]['Enums']["auto_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"booking_events": {
                  Row: {
                    "actor_id": string | null,"actor_role": Database["public"]['Enums']["user_role"] | null,"booking_id": string,"created_at": string,"from_status": Database["public"]['Enums']["booking_status"] | null,"id": number,"metadata": NonNullable<Json>,"to_status": Database["public"]['Enums']["booking_status"],"trip_id": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"booking_id": string,"created_at"?: string,"from_status"?: Database["public"]['Enums']["booking_status"] | null,"id"?: never,"metadata"?: NonNullable<Json>,"to_status": Database["public"]['Enums']["booking_status"],"trip_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"booking_id"?: string,"created_at"?: string,"from_status"?: Database["public"]['Enums']["booking_status"] | null,"id"?: never,"metadata"?: NonNullable<Json>,"to_status"?: Database["public"]['Enums']["booking_status"],"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "booking_events_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "booking_events_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"bookings": {
                  Row: {
                    "boarded_at": string | null,"cancel_reason": Database["public"]['Enums']["booking_cancel_reason"] | null,"cancelled_at": string | null,"cancelled_by": string | null,"code": string,"completed_at": string | null,"created_at": string,"created_by": string,"fare_per_seat_paise": number,"id": string,"idempotency_key": string,"no_show_at": string | null,"no_show_marked_by": string | null,"passenger_id": string | null,"payment_method": Database["public"]['Enums']["payment_method"],"platform_fee_paise": number,"seat_count": number,"seat_preference": Database["public"]['Enums']["seat_preference"],"source": Database["public"]['Enums']["booking_source"],"status": Database["public"]['Enums']["booking_status"],"total_fare_paise": number,"trip_id": string,"updated_at": string,"walk_in_label": string | null
                  }
                  Insert: {
                    "boarded_at"?: string | null,"cancel_reason"?: Database["public"]['Enums']["booking_cancel_reason"] | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"completed_at"?: string | null,"created_at"?: string,"created_by": string,"fare_per_seat_paise": number,"id"?: string,"idempotency_key": string,"no_show_at"?: string | null,"no_show_marked_by"?: string | null,"passenger_id"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"platform_fee_paise": number,"seat_count": number,"seat_preference"?: Database["public"]['Enums']["seat_preference"],"source": Database["public"]['Enums']["booking_source"],"status": Database["public"]['Enums']["booking_status"],"total_fare_paise": number,"trip_id": string,"updated_at"?: string,"walk_in_label"?: string | null
                  }
                  Update: {
                    "boarded_at"?: string | null,"cancel_reason"?: Database["public"]['Enums']["booking_cancel_reason"] | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"code"?: string,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string,"fare_per_seat_paise"?: number,"id"?: string,"idempotency_key"?: string,"no_show_at"?: string | null,"no_show_marked_by"?: string | null,"passenger_id"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"platform_fee_paise"?: number,"seat_count"?: number,"seat_preference"?: Database["public"]['Enums']["seat_preference"],"source"?: Database["public"]['Enums']["booking_source"],"status"?: Database["public"]['Enums']["booking_status"],"total_fare_paise"?: number,"trip_id"?: string,"updated_at"?: string,"walk_in_label"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_no_show_marked_by_fkey"
      columns: ["no_show_marked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_passenger_id_fkey"
      columns: ["passenger_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bookings_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"driver_presence": {
                  Row: {
                    "accuracy_m": number | null,"active_trip_id": string | null,"driver_id": string,"is_online": boolean,"last_seen_at": string | null,"lat": number | null,"lng": number | null,"location_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "accuracy_m"?: number | null,"active_trip_id"?: string | null,"driver_id": string,"is_online"?: boolean,"last_seen_at"?: string | null,"lat"?: number | null,"lng"?: number | null,"location_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"active_trip_id"?: string | null,"driver_id"?: string,"is_online"?: boolean,"last_seen_at"?: string | null,"lat"?: number | null,"lng"?: number | null,"location_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "driver_presence_active_trip_id_fkey"
      columns: ["active_trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "driver_presence_driver_id_fkey"
      columns: ["driver_id"]
isOneToOne: true
      referencedRelation: "drivers"
      referencedColumns: ["id"]
    }
                  ]
                },"drivers": {
                  Row: {
                    "created_at": string,"id": string,"license_number": string,"status": Database["public"]['Enums']["driver_status"],"updated_at": string,"verified_at": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id": string,"license_number": string,"status"?: Database["public"]['Enums']["driver_status"],"updated_at"?: string,"verified_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"license_number"?: string,"status"?: Database["public"]['Enums']["driver_status"],"updated_at"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "drivers_id_fkey"
      columns: ["id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"issues": {
                  Row: {
                    "assigned_to": string | null,"booking_id": string | null,"created_at": string,"description": string,"driver_id": string | null,"id": string,"kind": Database["public"]['Enums']["issue_kind"],"raised_by": string | null,"resolution_note": string | null,"resolved_at": string | null,"source": Database["public"]['Enums']["issue_source"],"status": Database["public"]['Enums']["issue_status"],"trip_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "assigned_to"?: string | null,"booking_id"?: string | null,"created_at"?: string,"description": string,"driver_id"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["issue_kind"],"raised_by"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"source": Database["public"]['Enums']["issue_source"],"status"?: Database["public"]['Enums']["issue_status"],"trip_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"booking_id"?: string | null,"created_at"?: string,"description"?: string,"driver_id"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["issue_kind"],"raised_by"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"source"?: Database["public"]['Enums']["issue_source"],"status"?: Database["public"]['Enums']["issue_status"],"trip_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "issues_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "issues_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "issues_driver_id_fkey"
      columns: ["driver_id"]
isOneToOne: false
      referencedRelation: "drivers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "issues_raised_by_fkey"
      columns: ["raised_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "issues_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"ledger_accounts": {
                  Row: {
                    "created_at": string,"id": string,"owner_profile_id": string | null,"type": Database["public"]['Enums']["ledger_account_type"]
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"owner_profile_id"?: string | null,"type": Database["public"]['Enums']["ledger_account_type"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"owner_profile_id"?: string | null,"type"?: Database["public"]['Enums']["ledger_account_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_accounts_owner_profile_id_fkey"
      columns: ["owner_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ledger_entries": {
                  Row: {
                    "account_id": string,"amount_paise": number,"created_at": string,"entry_type": Database["public"]['Enums']["ledger_entry_type"],"id": number,"transaction_id": string
                  }
                  Insert: {
                    "account_id": string,"amount_paise": number,"created_at"?: string,"entry_type": Database["public"]['Enums']["ledger_entry_type"],"id"?: never,"transaction_id": string
                  }
                  Update: {
                    "account_id"?: string,"amount_paise"?: number,"created_at"?: string,"entry_type"?: Database["public"]['Enums']["ledger_entry_type"],"id"?: never,"transaction_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_entries_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "ledger_account_balances"
      referencedColumns: ["account_id"]
    },{
      foreignKeyName: "ledger_entries_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "ledger_accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_entries_transaction_id_fkey"
      columns: ["transaction_id"]
isOneToOne: false
      referencedRelation: "ledger_transactions"
      referencedColumns: ["id"]
    }
                  ]
                },"ledger_transactions": {
                  Row: {
                    "booking_id": string | null,"created_at": string,"created_by": string | null,"description": string,"id": string,"idempotency_key": string,"reverses_transaction_id": string | null,"trip_id": string | null,"type": Database["public"]['Enums']["ledger_entry_type"]
                  }
                  Insert: {
                    "booking_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description": string,"id"?: string,"idempotency_key": string,"reverses_transaction_id"?: string | null,"trip_id"?: string | null,"type": Database["public"]['Enums']["ledger_entry_type"]
                  }
                  Update: {
                    "booking_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"id"?: string,"idempotency_key"?: string,"reverses_transaction_id"?: string | null,"trip_id"?: string | null,"type"?: Database["public"]['Enums']["ledger_entry_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_transactions_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_transactions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_transactions_reverses_transaction_id_fkey"
      columns: ["reverses_transaction_id"]
isOneToOne: false
      referencedRelation: "ledger_transactions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ledger_transactions_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "commission_bps": number,"driver_intervention_seconds": number,"driver_stale_seconds": number,"id": number,"location_update_interval_seconds": number,"max_seats_per_booking": number,"min_location_update_interval_seconds": number,"no_show_grace_seconds": number,"updated_at": string,"updated_by": string | null,"walk_in_commission_bps": number
                  }
                  Insert: {
                    "commission_bps"?: number,"driver_intervention_seconds"?: number,"driver_stale_seconds"?: number,"id"?: number,"location_update_interval_seconds"?: number,"max_seats_per_booking"?: number,"min_location_update_interval_seconds"?: number,"no_show_grace_seconds"?: number,"updated_at"?: string,"updated_by"?: string | null,"walk_in_commission_bps"?: number
                  }
                  Update: {
                    "commission_bps"?: number,"driver_intervention_seconds"?: number,"driver_stale_seconds"?: number,"id"?: number,"location_update_interval_seconds"?: number,"max_seats_per_booking"?: number,"min_location_update_interval_seconds"?: number,"no_show_grace_seconds"?: number,"updated_at"?: string,"updated_by"?: string | null,"walk_in_commission_bps"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"phone": string | null,"role": Database["public"]['Enums']["user_role"],"status": Database["public"]['Enums']["account_status"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id": string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"status"?: Database["public"]['Enums']["account_status"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"routes": {
                  Row: {
                    "approx_distance_m": number | null,"created_at": string,"destination_stop_id": string,"display_order": number,"fare_paise": number,"id": string,"is_active": boolean,"origin_stop_id": string,"updated_at": string
                  }
                  Insert: {
                    "approx_distance_m"?: number | null,"created_at"?: string,"destination_stop_id": string,"display_order"?: number,"fare_paise": number,"id"?: string,"is_active"?: boolean,"origin_stop_id": string,"updated_at"?: string
                  }
                  Update: {
                    "approx_distance_m"?: number | null,"created_at"?: string,"destination_stop_id"?: string,"display_order"?: number,"fare_paise"?: number,"id"?: string,"is_active"?: boolean,"origin_stop_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "routes_destination_stop_id_fkey"
      columns: ["destination_stop_id"]
isOneToOne: false
      referencedRelation: "stops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "routes_origin_stop_id_fkey"
      columns: ["origin_stop_id"]
isOneToOne: false
      referencedRelation: "stops"
      referencedColumns: ["id"]
    }
                  ]
                },"settings_events": {
                  Row: {
                    "changed_by": string | null,"created_at": string,"id": number,"new_values": NonNullable<Json>,"old_values": NonNullable<Json>
                  }
                  Insert: {
                    "changed_by"?: string | null,"created_at"?: string,"id"?: never,"new_values": NonNullable<Json>,"old_values": NonNullable<Json>
                  }
                  Update: {
                    "changed_by"?: string | null,"created_at"?: string,"id"?: never,"new_values"?: NonNullable<Json>,"old_values"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"stops": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"lat": number,"lng": number,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"lat": number,"lng": number,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"lat"?: number,"lng"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"trip_events": {
                  Row: {
                    "actor_id": string | null,"actor_role": Database["public"]['Enums']["user_role"] | null,"created_at": string,"from_status": Database["public"]['Enums']["trip_status"] | null,"id": number,"metadata": NonNullable<Json>,"to_status": Database["public"]['Enums']["trip_status"],"trip_id": string
                  }
                  Insert: {
                    "actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["trip_status"] | null,"id"?: never,"metadata"?: NonNullable<Json>,"to_status": Database["public"]['Enums']["trip_status"],"trip_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"actor_role"?: Database["public"]['Enums']["user_role"] | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["trip_status"] | null,"id"?: never,"metadata"?: NonNullable<Json>,"to_status"?: Database["public"]['Enums']["trip_status"],"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_events_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trips": {
                  Row: {
                    "auto_id": string,"cancel_reason": Database["public"]['Enums']["trip_cancel_reason"] | null,"cancelled_at": string | null,"capacity": number,"completed_at": string | null,"created_at": string,"driver_id": string,"fare_paise": number,"final_call_at": string | null,"id": string,"no_show_eligible_at": string | null,"opened_at": string,"route_id": string,"started_at": string | null,"status": Database["public"]['Enums']["trip_status"],"suspended_at": string | null,"suspended_from_status": Database["public"]['Enums']["trip_status"] | null,"updated_at": string
                  }
                  Insert: {
                    "auto_id": string,"cancel_reason"?: Database["public"]['Enums']["trip_cancel_reason"] | null,"cancelled_at"?: string | null,"capacity": number,"completed_at"?: string | null,"created_at"?: string,"driver_id": string,"fare_paise": number,"final_call_at"?: string | null,"id"?: string,"no_show_eligible_at"?: string | null,"opened_at"?: string,"route_id": string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["trip_status"],"suspended_at"?: string | null,"suspended_from_status"?: Database["public"]['Enums']["trip_status"] | null,"updated_at"?: string
                  }
                  Update: {
                    "auto_id"?: string,"cancel_reason"?: Database["public"]['Enums']["trip_cancel_reason"] | null,"cancelled_at"?: string | null,"capacity"?: number,"completed_at"?: string | null,"created_at"?: string,"driver_id"?: string,"fare_paise"?: number,"final_call_at"?: string | null,"id"?: string,"no_show_eligible_at"?: string | null,"opened_at"?: string,"route_id"?: string,"started_at"?: string | null,"status"?: Database["public"]['Enums']["trip_status"],"suspended_at"?: string | null,"suspended_from_status"?: Database["public"]['Enums']["trip_status"] | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trips_auto_id_fkey"
      columns: ["auto_id"]
isOneToOne: false
      referencedRelation: "autos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trips_driver_id_fkey"
      columns: ["driver_id"]
isOneToOne: false
      referencedRelation: "drivers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trips_route_id_fkey"
      columns: ["route_id"]
isOneToOne: false
      referencedRelation: "routes"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "ledger_account_balances": {
                  Row: {
                    "account_id": string | null,"balance_paise": number | null,"entry_count": number | null,"owner_profile_id": string | null,"type": Database["public"]['Enums']["ledger_account_type"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ledger_accounts_owner_profile_id_fkey"
      columns: ["owner_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_walk_in":
{ Args: { "p_idempotency_key": string,"p_label"?: string,"p_seat_count": number,"p_trip_id": string }; Returns: {
              "boarded_at": string | null,
"cancel_reason": Database["public"]['Enums']["booking_cancel_reason"] | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"code": string,
"completed_at": string | null,
"created_at": string,
"created_by": string,
"fare_per_seat_paise": number,
"id": string,
"idempotency_key": string,
"no_show_at": string | null,
"no_show_marked_by": string | null,
"passenger_id": string | null,
"payment_method": Database["public"]['Enums']["payment_method"],
"platform_fee_paise": number,
"seat_count": number,
"seat_preference": Database["public"]['Enums']["seat_preference"],
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["booking_status"],
"total_fare_paise": number,
"trip_id": string,
"updated_at": string,
"walk_in_label": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_set_user_role":
{ Args: { "p_role": Database["public"]['Enums']["user_role"],"p_user_id": string }; Returns: {
              "created_at": string,
"email": string | null,
"full_name": string,
"id": string,
"phone": string | null,
"role": Database["public"]['Enums']["user_role"],
"status": Database["public"]['Enums']["account_status"],
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"book_seats":
{ Args: { "p_idempotency_key": string,"p_seat_count": number,"p_seat_preference"?: Database["public"]['Enums']["seat_preference"],"p_trip_id": string }; Returns: {
              "boarded_at": string | null,
"cancel_reason": Database["public"]['Enums']["booking_cancel_reason"] | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"code": string,
"completed_at": string | null,
"created_at": string,
"created_by": string,
"fare_per_seat_paise": number,
"id": string,
"idempotency_key": string,
"no_show_at": string | null,
"no_show_marked_by": string | null,
"passenger_id": string | null,
"payment_method": Database["public"]['Enums']["payment_method"],
"platform_fee_paise": number,
"seat_count": number,
"seat_preference": Database["public"]['Enums']["seat_preference"],
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["booking_status"],
"total_fare_paise": number,
"trip_id": string,
"updated_at": string,
"walk_in_label": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_booking":
{ Args: { "p_booking_id": string }; Returns: {
              "boarded_at": string | null,
"cancel_reason": Database["public"]['Enums']["booking_cancel_reason"] | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"code": string,
"completed_at": string | null,
"created_at": string,
"created_by": string,
"fare_per_seat_paise": number,
"id": string,
"idempotency_key": string,
"no_show_at": string | null,
"no_show_marked_by": string | null,
"passenger_id": string | null,
"payment_method": Database["public"]['Enums']["payment_method"],
"platform_fee_paise": number,
"seat_count": number,
"seat_preference": Database["public"]['Enums']["seat_preference"],
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["booking_status"],
"total_fare_paise": number,
"trip_id": string,
"updated_at": string,
"walk_in_label": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancel_trip":
{ Args: { "p_reason"?: Database["public"]['Enums']["trip_cancel_reason"],"p_trip_id": string }; Returns: {
              "auto_id": string,
"cancel_reason": Database["public"]['Enums']["trip_cancel_reason"] | null,
"cancelled_at": string | null,
"capacity": number,
"completed_at": string | null,
"created_at": string,
"driver_id": string,
"fare_paise": number,
"final_call_at": string | null,
"id": string,
"no_show_eligible_at": string | null,
"opened_at": string,
"route_id": string,
"started_at": string | null,
"status": Database["public"]['Enums']["trip_status"],
"suspended_at": string | null,
"suspended_from_status": Database["public"]['Enums']["trip_status"] | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "trips"
        isOneToOne: true
        isSetofReturn: false
      } },
"complete_trip":
{ Args: { "p_trip_id": string }; Returns: {
              "auto_id": string,
"cancel_reason": Database["public"]['Enums']["trip_cancel_reason"] | null,
"cancelled_at": string | null,
"capacity": number,
"completed_at": string | null,
"created_at": string,
"driver_id": string,
"fare_paise": number,
"final_call_at": string | null,
"id": string,
"no_show_eligible_at": string | null,
"opened_at": string,
"route_id": string,
"started_at": string | null,
"status": Database["public"]['Enums']["trip_status"],
"suspended_at": string | null,
"suspended_from_status": Database["public"]['Enums']["trip_status"] | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "trips"
        isOneToOne: true
        isSetofReturn: false
      } },
"driver_earnings_summary":
{ Args: { "p_driver_id"?: string,"p_from"?: string,"p_to"?: string }; Returns: Json
                           },
"driver_heartbeat":
{ Args: { "p_accuracy_m"?: number,"p_lat"?: number,"p_lng"?: number }; Returns: Json
                           },
"final_call":
{ Args: { "p_trip_id": string }; Returns: {
              "auto_id": string,
"cancel_reason": Database["public"]['Enums']["trip_cancel_reason"] | null,
"cancelled_at": string | null,
"capacity": number,
"completed_at": string | null,
"created_at": string,
"driver_id": string,
"fare_paise": number,
"final_call_at": string | null,
"id": string,
"no_show_eligible_at": string | null,
"opened_at": string,
"route_id": string,
"started_at": string | null,
"status": Database["public"]['Enums']["trip_status"],
"suspended_at": string | null,
"suspended_from_status": Database["public"]['Enums']["trip_status"] | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "trips"
        isOneToOne: true
        isSetofReturn: false
      } },
"get_driver_home":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_my_active_booking":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_my_booking":
{ Args: { "p_booking_id": string }; Returns: Json
                           },
"get_my_booking_history":
{ Args: { "p_before"?: string,"p_limit"?: number }; Returns: Json
                           },
"get_platform_settings_public":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_server_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_trip_manifest":
{ Args: { "p_trip_id": string }; Returns: Json
                           },
"go_offline":
{ Args: Record<PropertyKey, never>; Returns: {
              "accuracy_m": number | null,
"active_trip_id": string | null,
"driver_id": string,
"is_online": boolean,
"last_seen_at": string | null,
"lat": number | null,
"lng": number | null,
"location_at": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "driver_presence"
        isOneToOne: true
        isSetofReturn: false
      } },
"mark_boarded":
{ Args: { "p_booking_id": string }; Returns: {
              "boarded_at": string | null,
"cancel_reason": Database["public"]['Enums']["booking_cancel_reason"] | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"code": string,
"completed_at": string | null,
"created_at": string,
"created_by": string,
"fare_per_seat_paise": number,
"id": string,
"idempotency_key": string,
"no_show_at": string | null,
"no_show_marked_by": string | null,
"passenger_id": string | null,
"payment_method": Database["public"]['Enums']["payment_method"],
"platform_fee_paise": number,
"seat_count": number,
"seat_preference": Database["public"]['Enums']["seat_preference"],
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["booking_status"],
"total_fare_paise": number,
"trip_id": string,
"updated_at": string,
"walk_in_label": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"mark_no_show":
{ Args: { "p_booking_id": string }; Returns: {
              "boarded_at": string | null,
"cancel_reason": Database["public"]['Enums']["booking_cancel_reason"] | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"code": string,
"completed_at": string | null,
"created_at": string,
"created_by": string,
"fare_per_seat_paise": number,
"id": string,
"idempotency_key": string,
"no_show_at": string | null,
"no_show_marked_by": string | null,
"passenger_id": string | null,
"payment_method": Database["public"]['Enums']["payment_method"],
"platform_fee_paise": number,
"seat_count": number,
"seat_preference": Database["public"]['Enums']["seat_preference"],
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["booking_status"],
"total_fare_paise": number,
"trip_id": string,
"updated_at": string,
"walk_in_label": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"open_trip":
{ Args: { "p_auto_id": string,"p_route_id": string }; Returns: {
              "auto_id": string,
"cancel_reason": Database["public"]['Enums']["trip_cancel_reason"] | null,
"cancelled_at": string | null,
"capacity": number,
"completed_at": string | null,
"created_at": string,
"driver_id": string,
"fare_paise": number,
"final_call_at": string | null,
"id": string,
"no_show_eligible_at": string | null,
"opened_at": string,
"route_id": string,
"started_at": string | null,
"status": Database["public"]['Enums']["trip_status"],
"suspended_at": string | null,
"suspended_from_status": Database["public"]['Enums']["trip_status"] | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "trips"
        isOneToOne: true
        isSetofReturn: false
      } },
"raise_issue":
{ Args: { "p_booking_id"?: string,"p_description": string,"p_kind": Database["public"]['Enums']["issue_kind"],"p_trip_id"?: string }; Returns: {
              "assigned_to": string | null,
"booking_id": string | null,
"created_at": string,
"description": string,
"driver_id": string | null,
"id": string,
"kind": Database["public"]['Enums']["issue_kind"],
"raised_by": string | null,
"resolution_note": string | null,
"resolved_at": string | null,
"source": Database["public"]['Enums']["issue_source"],
"status": Database["public"]['Enums']["issue_status"],
"trip_id": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "issues"
        isOneToOne: true
        isSetofReturn: false
      } },
"remove_walk_in":
{ Args: { "p_booking_id": string }; Returns: {
              "boarded_at": string | null,
"cancel_reason": Database["public"]['Enums']["booking_cancel_reason"] | null,
"cancelled_at": string | null,
"cancelled_by": string | null,
"code": string,
"completed_at": string | null,
"created_at": string,
"created_by": string,
"fare_per_seat_paise": number,
"id": string,
"idempotency_key": string,
"no_show_at": string | null,
"no_show_marked_by": string | null,
"passenger_id": string | null,
"payment_method": Database["public"]['Enums']["payment_method"],
"platform_fee_paise": number,
"seat_count": number,
"seat_preference": Database["public"]['Enums']["seat_preference"],
"source": Database["public"]['Enums']["booking_source"],
"status": Database["public"]['Enums']["booking_status"],
"total_fare_paise": number,
"trip_id": string,
"updated_at": string,
"walk_in_label": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "bookings"
        isOneToOne: true
        isSetofReturn: false
      } },
"resume_trip":
{ Args: { "p_trip_id": string }; Returns: {
              "auto_id": string,
"cancel_reason": Database["public"]['Enums']["trip_cancel_reason"] | null,
"cancelled_at": string | null,
"capacity": number,
"completed_at": string | null,
"created_at": string,
"driver_id": string,
"fare_paise": number,
"final_call_at": string | null,
"id": string,
"no_show_eligible_at": string | null,
"opened_at": string,
"route_id": string,
"started_at": string | null,
"status": Database["public"]['Enums']["trip_status"],
"suspended_at": string | null,
"suspended_from_status": Database["public"]['Enums']["trip_status"] | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "trips"
        isOneToOne: true
        isSetofReturn: false
      } },
"search_trips":
{ Args: { "p_destination_stop_id": string,"p_origin_stop_id": string }; Returns: {
              "auto_colour": string,"auto_model": string,"auto_registration": string,"available_seats": number,"capacity": number,"driver_first_name": string,"driver_lat": number,"driver_lng": number,"fare_paise": number,"location_at": string,"opened_at": string,"route_id": string,"trip_id": string
            }[]
                           },
"start_trip":
{ Args: { "p_trip_id": string }; Returns: {
              "auto_id": string,
"cancel_reason": Database["public"]['Enums']["trip_cancel_reason"] | null,
"cancelled_at": string | null,
"capacity": number,
"completed_at": string | null,
"created_at": string,
"driver_id": string,
"fare_paise": number,
"final_call_at": string | null,
"id": string,
"no_show_eligible_at": string | null,
"opened_at": string,
"route_id": string,
"started_at": string | null,
"status": Database["public"]['Enums']["trip_status"],
"suspended_at": string | null,
"suspended_from_status": Database["public"]['Enums']["trip_status"] | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "trips"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "account_status": "ACTIVE"|"SUSPENDED","auto_status": "ACTIVE"|"INACTIVE","booking_cancel_reason": "PASSENGER_CANCELLED"|"TRIP_CANCELLED"|"DRIVER_UNREACHABLE"|"WALK_IN_REMOVED"|"ADMIN_CANCELLED","booking_source": "APP"|"WALK_IN","booking_status": "CONFIRMED"|"BOARDED"|"COMPLETED"|"CANCELLED"|"NO_SHOW","driver_status": "PENDING_VERIFICATION"|"ACTIVE"|"SUSPENDED","issue_kind": "DRIVER_UNREACHABLE"|"TRIP_STUCK"|"BOOKING_ISSUE"|"DRIVER_BEHAVIOUR"|"PAYMENT"|"OTHER","issue_source": "PASSENGER"|"DRIVER"|"SYSTEM","issue_status": "OPEN"|"IN_REVIEW"|"RESOLVED"|"CLOSED","ledger_account_type": "PASSENGER_CREDIT"|"DRIVER_SETTLEMENT"|"PLATFORM_REVENUE"|"PLATFORM_CASH"|"PAYMENT_CLEARING","ledger_entry_type": "PAYMENT"|"BOOKING_DEBIT"|"REFUND_CREDIT"|"ADJUSTMENT"|"DRIVER_EARNING"|"PLATFORM_FEE"|"SETTLEMENT","payment_method": "CASH","seat_preference": "ANY"|"BACK"|"FRONT","trip_cancel_reason": "DRIVER_CANCELLED"|"DRIVER_OFFLINE"|"DRIVER_UNREACHABLE"|"ADMIN_CANCELLED","trip_status": "OPEN"|"BOARDING"|"IN_PROGRESS"|"COMPLETED"|"CANCELLED"|"SUSPENDED","user_role": "PASSENGER"|"DRIVER"|"ADMIN"
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
  "public": {
          Enums: {
            "account_status": ["ACTIVE", "SUSPENDED"],"auto_status": ["ACTIVE", "INACTIVE"],"booking_cancel_reason": ["PASSENGER_CANCELLED", "TRIP_CANCELLED", "DRIVER_UNREACHABLE", "WALK_IN_REMOVED", "ADMIN_CANCELLED"],"booking_source": ["APP", "WALK_IN"],"booking_status": ["CONFIRMED", "BOARDED", "COMPLETED", "CANCELLED", "NO_SHOW"],"driver_status": ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED"],"issue_kind": ["DRIVER_UNREACHABLE", "TRIP_STUCK", "BOOKING_ISSUE", "DRIVER_BEHAVIOUR", "PAYMENT", "OTHER"],"issue_source": ["PASSENGER", "DRIVER", "SYSTEM"],"issue_status": ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"],"ledger_account_type": ["PASSENGER_CREDIT", "DRIVER_SETTLEMENT", "PLATFORM_REVENUE", "PLATFORM_CASH", "PAYMENT_CLEARING"],"ledger_entry_type": ["PAYMENT", "BOOKING_DEBIT", "REFUND_CREDIT", "ADJUSTMENT", "DRIVER_EARNING", "PLATFORM_FEE", "SETTLEMENT"],"payment_method": ["CASH"],"seat_preference": ["ANY", "BACK", "FRONT"],"trip_cancel_reason": ["DRIVER_CANCELLED", "DRIVER_OFFLINE", "DRIVER_UNREACHABLE", "ADMIN_CANCELLED"],"trip_status": ["OPEN", "BOARDING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "SUSPENDED"],"user_role": ["PASSENGER", "DRIVER", "ADMIN"]
          }
        }
} as const

