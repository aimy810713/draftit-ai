
import { DocType, DocConfig } from './types';

export const DOCUMENT_CONFIGS: Record<string, DocConfig> = {
  resignation: {
    id: 'resignation',
    type: DocType.RESIGNATION,
    title: 'Professional Resignation',
    icon: '',
    description: 'A resignation letter that keeps your reputation safe.',
    fields: [
      { name: 'name', label: 'Your Full Name', type: 'text', required: true },
      { name: 'company', label: 'Company Name', type: 'text', required: true },
      { name: 'title', label: 'Your Designation', type: 'text', required: true },
      { name: 'lastDay', label: 'Your Last Working Day', type: 'date', required: true },
      { name: 'reason', label: 'Reason for leaving (Optional)', type: 'textarea' },
    ]
  },
  bank: {
    id: 'bank',
    type: DocType.BANK_COMPLAINT,
    title: 'Bank Communication',
    icon: '',
    description: 'Correct standard formats to resolve banking issues.',
    fields: [
      { name: 'name', label: 'Account Holder Name', type: 'text', required: true },
      { name: 'bankName', label: 'Bank & Branch Name', type: 'text', required: true },
      { name: 'accNumber', label: 'Account or Card Number', type: 'text', required: true },
      { name: 'issue', label: 'Describe your problem clearly', type: 'textarea', required: true },
    ]
  },
  police: {
    id: 'police',
    type: DocType.POLICE_COMPLAINT,
    title: 'Police Intimation',
    icon: '',
    description: 'Clear, formal drafts for reporting incidents.',
    fields: [
      { name: 'name', label: 'Your Full Name', type: 'text', required: true },
      { name: 'address', label: 'Your Address', type: 'textarea', required: true },
      { name: 'incidentType', label: 'What was lost or what happened?', type: 'text', required: true },
      { name: 'date', label: 'Date and Time of incident', type: 'date', required: true },
      { name: 'description', label: 'Incident details', type: 'textarea', required: true },
    ]
  },
  college: {
    id: 'college',
    type: DocType.COLLEGE_APP,
    title: 'Academic Application',
    icon: '',
    description: 'Professional applications that get approved.',
    fields: [
      { name: 'name', label: 'Student Name', type: 'text', required: true },
      { name: 'course', label: 'Course & Roll Number', type: 'text', required: true },
      { name: 'previousCollege', label: 'College/School Name', type: 'text', required: true },
      { name: 'achievement', label: 'Reason or Achievement', type: 'textarea' },
    ]
  },
  apology: {
    id: 'apology',
    type: DocType.OFFICE_APOLOGY,
    title: 'Workplace Apology',
    icon: '',
    description: 'A respectful way to address workplace mistakes.',
    fields: [
      { name: 'name', label: 'Your Name', type: 'text', required: true },
      { name: 'manager', label: 'Manager Name/Role', type: 'text', required: true },
      { name: 'mistake', label: 'What happened?', type: 'textarea', required: true },
      { name: 'action', label: 'How will you fix it?', type: 'textarea' },
    ]
  },
  leave: {
    id: 'leave',
    type: DocType.LEAVE_LETTER,
    title: 'Leave Application',
    icon: '',
    description: 'Polite requests that managers can’t say no to.',
    fields: [
      { name: 'name', label: 'Your Name', type: 'text', required: true },
      { name: 'type', label: 'Type (Sick/Family/Vacation)', type: 'text', required: true },
      { name: 'startDate', label: 'Leave Start Date', type: 'date', required: true },
      { name: 'endDate', label: 'Leave End Date', type: 'date', required: true },
      { name: 'reason', label: 'Reason for Leave', type: 'textarea', required: true },
    ]
  }
};
