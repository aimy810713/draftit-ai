
export enum DocType {
  RESIGNATION = 'Resignation Letter',
  BANK_COMPLAINT = 'Bank Complaint',
  POLICE_COMPLAINT = 'Police Complaint',
  COLLEGE_APP = 'College Application',
  OFFICE_APOLOGY = 'Office Apology',
  LEAVE_LETTER = 'Leave Letter'
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'date';
  placeholder?: string;
  required?: boolean;
}

export interface DocConfig {
  id: string;
  type: DocType;
  title: string;
  icon: string;
  description: string;
  fields: FormField[];
}

export interface GeneratedDoc {
  id: string;
  document_type: DocType;
  generated_text: string;
  input_data?: any;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  plan: string;
  credits_remaining: number;
}
