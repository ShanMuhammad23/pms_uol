# PMS Email Notification System — Reference Document

**Performance Management System (PMS)**
University of Lahore

This document describes every automated email notification sent by the PMS
throughout the performance appraisal workflow. Each notification is triggered
automatically when a submission moves between workflow stages.

---

## Email Branding & Layout

All emails share a consistent professional layout:

- **Header:** "Performance Management System" with "University of Lahore" subtitle, on a dark blue background.
- **Body:** White background with clear typography and structured info rows.
- **Footer:** "This is an automated message from the Performance Management System. Please do not reply to this email."
- **Format:** Each email is sent in both HTML (styled) and plain-text (fallback) formats.

---

## Workflow Notification Summary

| # | Trigger | Recipient | Subject Line |
|---|---------|-----------|--------------|
| 1 | Employee submits self-assessment | Employee | PMS Submission Received – Self-Assessment Completed |
| 5 | Board grants final approval | Employee | PMS Submission Approved – Final Approval |
| 6 | Submission returned to Employee | Employee | Action Required – PMS Submission Returned |
| 7a | Submission returned to Manager 1 | Manager 1 | Action Required – PMS Submission Returned to Manager 1 |
| 8a | Submission returned to Manager 2 | Manager 2 | Action Required – PMS Submission Returned to Manager 2 |

---

## Detailed Email Contents

### 1. Self-Assessment Submitted

**Trigger:** Employee completes and submits their self-assessment.
**Recipient:** Employee

> Dear [Employee Name]
>
> Your self-assessment has been completed and submitted successfully.
>
> **Current Status:** Self-Assessment Completed
>
> Your submission will now proceed to the next stage of the performance assessment process.
>
> You do not need to take any further action at this stage unless requested by the PMS.

---

### 5. Board Approved (Final Approval)

**Trigger:** Board grants final approval — the submission has completed the full workflow.
**Recipient:** Employee

> Dear [Employee Name]
>
> We are pleased to inform you that your performance assessment has been approved by the Board.
>
> **Status:** Final Approval Completed
>
> Thank you for completing the performance assessment process.

---

### 6. Returned to Employee

**Trigger:** A reviewer returns the submission back to the employee for revision.
**Recipient:** Employee

> Dear [Employee Name]
>
> Your self-assessment submission has been returned to you for further review and action.
>
> **Current Status:** Returned to Employee
>
> Please log in to the Performance Management System, review your submission, and make the required changes. Please ensure that all required information is complete before submitting again.
>
> **Return Reason:** [Reason provided by the reviewer, if any]

---

### 7a. Returned to Manager 1 — Manager Notification

**Trigger:** Submission is returned to Manager 1 for further action.
**Recipient:** Manager 1 only (employee is NOT notified)

> Dear [Manager 1 Name]
>
> A self-assessment submission of your staff has been returned to you for further review and action.
>
> **Employee:** [Employee Name]
> **Current Status:** Returned to Manager 1
>
> Please log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.
>
> **Return Reason:** [Reason provided by the reviewer, if any]

---

### 8a. Returned to Manager 2 — Manager Notification

**Trigger:** Submission is returned to Manager 2 for further action.
**Recipient:** Manager 2 only (employee is NOT notified)

> Dear [Manager 2 Name]
>
> A self-assessment submission of your staff has been returned to you for further review and action.
>
> **Employee:** [Employee Name]
> **Current Status:** Returned to Manager 2
>
> Please log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.
>
> **Return Reason:** [Reason provided by the reviewer, if any]

---

## Technical Notes

- **Sender:** pms@hrd.uol.edu.pk
- **Delivery:** Emails are sent via authenticated SMTP (Gmail App Password).
- **Reliability:** Email sending is fire-and-forget — if an email fails to send, it does not block or rollback the workflow operation. A log entry is recorded.
- **Security:** All user-provided content (names, return reasons) is HTML-escaped to prevent injection attacks.
- **Privacy:** Emails contain only the recipient's own name and workflow status. No other employee's sensitive data is included.
- **No-reply:** All emails include a footer stating they are automated and should not be replied to.
