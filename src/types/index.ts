export interface User {
  id: number
  student_number: string | null
  name: string
  email: string | null
  phone: string | null
  institute: string | null
  program: string | null
  year_level: number | null
  sex: string | null
  profile_photo: string | null
  is_active: boolean
  needs_onboarding: boolean
  academic_term?: string | null
}

export interface OnboardingData {
  needs_onboarding: boolean
  institutes: Record<string, string>
  programs: Record<string, string[]>
}

export interface Workspace {
  id: string
  name: string
  code: string
  type: 'ssc' | 'isc' | 'sro' | 'student'
  role: string
  organization_id: number | null
}

export interface Organization {
  id: number
  parent_id: number | null
  name: string
  code: string
  type: string
  description: string | null
  is_active: boolean
  children?: Organization[]
}

export interface Event {
  id: string
  organization_id: number
  title: string
  description: string | null
  venue: string | null
  time_from: string | null
  time_to: string | null
  event_date: string
  status: string
  organization?: {
    id: number
    name: string
    type: string
  }
  attendees_count?: number
  required_years?: string[]
  qr_configurations?: QrConfiguration[]
}

export interface QrConfiguration {
  id: number
  event_id: number
  type: 'time_in' | 'time_out'
  valid_from: string
  valid_until: string
  latitude: number | null
  longitude: number | null
  geofence_radius: number | null
  required_years: string[] | null
  qr_data: string | null
  is_generated: boolean
}

export interface Attendance {
  id: number
  qr_configuration_id: number
  user_id: number
  scanned_at: string
  synced_at: string | null
  event?: {
    id: string
    title: string
    event_date: string
    venue: string | null
    status: string
    organization?: {
      id: number
      name: string
      type: string
    }
  }
  qr_configuration?: {
    id: number
    type: 'time_in' | 'time_out'
  }
}

export interface OrgEventStats {
  id: number
  name: string
  code: string
  type: string
  total_events: number
  upcoming_count: number
}

export interface OrgAttendanceStats {
  id: number
  name: string
  type: string
  total: number
  complete: number
}

export interface EventAttendanceSummary {
  event: {
    id: string
    title: string
    event_date: string
    venue: string | null
    status: string
    organization?: {
      id: number
      name: string
      type: string
    } | null
  }
  attended_count: number
  total_qr_configs: number
  complete: boolean
  attendances: {
    id: number
    qr_configuration_id: number
    type: 'time_in' | 'time_out'
    scanned_at: string
    synced_at: string | null
  }[]
}

export interface Fee {
  id: number
  type: 'fee'
  obligation_key: string
  organization_id: number
  org_id?: number
  name: string
  description: string | null
  amount: number
  term: string | null
  academic_term?: string | null
  required_years: string[] | null
  due_date: string | null
  status: string
  organization?: {
    id: number
    name: string
    type: string
  }
  obligation_status?: 'due' | 'paid' | 'exempted'
}

export interface Penalty {
  id: number
  type: 'penalty'
  obligation_key: string
  obligation_id?: number | null
  event_id: number | null
  unit_amount?: number
  academic_term?: string | null
  amount: number
  absences?: number
  missing_qr_configurations?: {
    id: number
    type: string | null
    valid_from: string | null
    valid_until: string | null
  }[]
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  isExempted: boolean
  event?: {
    id: number
    title: string
    event_date: string
    organization?: {
      id: number
      name: string
      type: string
    } | null
  } | null
}

export interface Payment {
  id: number
  user_id: number
  organization_id: number
  academic_term_id: number | null
  fee_type: 'fee' | 'penalty'
  fee_id: number | null
  event_id: number | null
  amount: number
  payment_method: string | null
  reference_number: string | null
  status: 'paid' | 'exempted' | 'refunded' | 'pending'
  isExempted: boolean
  paid_at: string | null
  exempted_at: string | null
  created_at: string
  academic_term?: string | null
  organization?: {
    id: number
    name: string
  }
  fee?: {
    id: number
    name: string
  }
  receipt?: {
    id: number
    receipt_number: string
    issued_at: string | null
  }
  absences?: number
  missing_qr_configurations?: {
    id: number
    type: string | null
    valid_from: string | null
    valid_until: string | null
  }[]
  event?: {
    id: number
    title: string
    event_date: string
    organization?: {
      id: number
      name: string
      type: string
    } | null
  } | null
}

export interface PaymentAccount {
  organization_id: number
  organization_name: string | null
  account_name: string
  account_provider: string | null
  account_number: string
  qr_code_image_url: string | null
}

export interface PaymentSubmissionItem {
  fee_type: 'fee' | 'penalty'
  amount: number
  fee?: { id: number; name: string } | null
  event?: { id: number; title: string } | null
  status: string
}

export interface PaymentSubmissionGroup {
  group_key: string
  status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  reference_number: string | null
  receipt_image_url: string | null
  payment_channel: string | null
  organization: { id: number; name: string } | null
  academic_term: string | null
  verified_at: string | null
  submitted_at: string
  items: PaymentSubmissionItem[]
}

export interface OutstandingPayload {
  fees: Fee[]
  penalties: Penalty[]
  total: number
  term: string | null
  unresolved: string[]
  payment_accounts: PaymentAccount[]
}

export interface Receipt {
  id: number
  payment_id: number
  receipt_number: string
  issued_at: string | null
  notes: string | null
  payment?: {
    id: number
    amount: number
    payment_method: string | null
    status: string
    paid_at: string | null
    user?: { id: number; name: string; student_number: string | null } | null
    organization?: { id: number; name: string } | null
  } | null
  issued_by?: { id: number; name: string } | null
}

export interface Notification {
  id: number
  type: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export interface OfflineAttendance {
  id?: number
  qr_configuration_id: number
  user_id: number
  scanned_at: string
  synced: boolean
  qr_payload: Record<string, unknown> | null
}
