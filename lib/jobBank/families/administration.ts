import { comp, family, role } from "../build";

export const ADMINISTRATION = family(
  "administration",
  "Administration and Office Support",
  "Reception, records, scheduling, correspondence and the smooth running of an office.",
  [
    comp("adm.records", "Office Administration and Records", "functional", "Keeping documents, files and office processes organised and easy to find.", [
      "Files and retrieves documents using the existing system.",
      "Keeps records and files tidy and follows the filing rules, with guidance.",
      "Maintains accurate, well-organised records and office processes alone and finds anything quickly.",
      "Improves filing and records systems, trains others and keeps records compliant.",
      "Designs the office administration system and sets standards for records, retention and confidentiality.",
    ]),
    comp("adm.scheduling", "Scheduling and Calendar Management", "functional", "Planning other people's time, meetings and priorities without clashes.", [
      "Books simple meetings from clear instructions.",
      "Manages a calendar and resolves simple clashes, with guidance.",
      "Manages busy calendars alone, protects priorities and anticipates conflicts.",
      "Manages the schedules of senior leaders, negotiates time and reshapes plans quickly.",
      "Runs the scheduling for a leadership team and sets the rules that make time work for the organisation.",
    ]),
    comp("adm.writing", "Business Writing and Correspondence", "functional", "Writing clear, correct and professional emails, letters and notes.", [
      "Writes short messages using templates.",
      "Writes clear emails and letters with few errors and adapts templates, with review.",
      "Writes accurate, professional correspondence and meeting notes without review.",
      "Drafts sensitive or senior-level correspondence and edits others' writing.",
      "Sets writing standards and drafts important communications on behalf of senior leaders.",
    ]),
    comp("adm.software", "Office Software Proficiency", "technical", "Using word processing, spreadsheet, presentation and email tools well.", [
      "Uses email and basic documents.",
      "Uses word processing, spreadsheets and presentations for routine tasks.",
      "Uses office software confidently: formatting, formulas, mail merge and shared documents.",
      "Builds templates and automates repeated tasks and trains others.",
      "Sets how the organisation uses office tools and designs efficient working methods.",
    ]),
    comp("adm.coordination", "Travel, Event and Meeting Coordination", "functional", "Organising travel, events and meetings so they run on time and on budget.", [
      "Helps set up meeting rooms and book simple travel.",
      "Books travel and arranges small meetings from a checklist.",
      "Plans travel, meetings and events alone, manages suppliers and keeps within budget.",
      "Runs larger events, handles last-minute changes and negotiates better terms with suppliers.",
      "Owns the events and travel programme, sets policy and controls cost and quality.",
    ]),
    comp("adm.confidentiality", "Confidentiality and Discretion", "behavioural", "Handling sensitive information and situations with care and good judgement.", [
      "Knows that some information is confidential and follows the rules.",
      "Keeps confidential information secure in routine work.",
      "Handles sensitive information reliably and judges what may be shared and with whom.",
      "Is trusted with the most sensitive matters and advises others on safe handling.",
      "Sets the confidentiality standards for the organisation and models discretion at every level.",
    ]),
  ],
  [
    role("adm.receptionist", "Receptionist", "Entry", 1, "ic",
      "Welcomes visitors, answers calls, directs enquiries and keeps the front desk in order.",
      { "adm.records": 2, "adm.writing": 2, "adm.software": 2, "adm.confidentiality": 2 }, { Communication: 3, "Critical Thinking": 1 }),
    role("adm.assistant", "Administrative Assistant", "Entry", 2, "ic",
      "Supports a team with records, correspondence, scheduling and day-to-day office tasks.",
      { "adm.records": 3, "adm.scheduling": 2, "adm.writing": 3, "adm.software": 3, "adm.coordination": 2, "adm.confidentiality": 2 }, { Communication: 3, "Critical Thinking": 2 }),
    role("adm.office_administrator", "Office Administrator", "Mid", 3, "ic",
      "Runs the office day to day: records, supplies, suppliers, visitors and support for several teams.",
      { "adm.records": 4, "adm.scheduling": 3, "adm.writing": 3, "adm.software": 3, "adm.coordination": 3, "adm.confidentiality": 3 }, { Communication: 3, "Critical Thinking": 3 }),
    role("adm.executive_assistant", "Executive Assistant", "Mid", 4, "ic",
      "Supports a senior leader: calendar, travel, correspondence, meetings and confidential matters.",
      { "adm.scheduling": 5, "adm.writing": 4, "adm.confidentiality": 5, "adm.coordination": 4, "adm.software": 4, "adm.records": 3 }, { Communication: 4, "Critical Thinking": 3 }),
    role("adm.office_manager", "Office Manager", "Manager", 5, "management",
      "Leads office support: team, suppliers, budget, facilities and standards for the workplace.",
      { "adm.records": 4, "adm.coordination": 4, "adm.scheduling": 3, "adm.software": 3, "adm.confidentiality": 4 },
      { Leadership: 3, "People Management": 3, Communication: 4, "Critical Thinking": 3, "Financial Literacy": 2 }),
  ]
);
