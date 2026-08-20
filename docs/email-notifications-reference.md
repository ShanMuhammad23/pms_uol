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
| 2 | Manager 1 approves submission | Employee | PMS Submission Update – Manager 1 Approval |
| 3 | Manager 2 approves submission | Employee | PMS Submission Update – Manager 2 Approval |
| 4 | HR approves submission | Employee | PMS Submission Update – HR Approval |
| 5 | Board grants final approval | Employee | PMS Submission Approved – Final Approval |
| 6 | Submission returned to Employee | Employee | Action Required – PMS Submission Returned |
| 7 | Submission returned to Manager 1 | Manager 1 | Action Required – PMS Submission Returned to Manager 1 |
| 8 | Submission returned to Manager 2 | Manager 2 | Action Required – PMS Submission Returned to Manager 2 |

---

## Detailed Email Contents

### 1. Self-Assessment Submitted

**Trigger:** Employee completes and submits their self-assessment.
**Recipient:** Employee

> Dear [Employee Name],
>
> Your performance assessment submission has been successfully received.
>
> Your self-assessment has been completed and submitted successfully.
>
> **Current Status:** Self-Assessment Completed
> **Next Stage:** [Next workflow stage label]
>
> Your submission will now proceed to the next stage of the performance assessment process.
>
> You do not need to take any further action at this stage unless requested by the PMS.

---

### 2. Manager 1 Approved

**Trigger:** Manager 1 reviews and approves the submission.
**Recipient:** Employee

> Dear [Employee Name]
>
> Your performance assessment submission has been reviewed and approved by Manager 1.
>
> **Current Status:** Manager 1 Approved
> **Next Stage:** [Next workflow stage label]
>
> Your submission will now proceed to the next stage of the performance assessment process.
>
> No further action is required from you at this stage unless the PMS requests it.

---

### 3. Manager 2 Approved

**Trigger:** Manager 2 reviews and approves the submission.
**Recipient:** Employee

> Dear [Employee Name]
>
> Your performance assessment submission has been reviewed and approved by Manager 2.
>
> **Current Status:** Manager 2 Approved
> **Next Stage:** [Next workflow stage label]
>
> Your submission will now proceed to the next stage of the performance assessment process.
>
> No further action is required from you at this stage unless the PMS requests it.

---

### 4. HR Approved

**Trigger:** HR reviews and approves the submission.
**Recipient:** Employee

> Dear [Employee Name]
>
> Your performance assessment submission has been reviewed and approved by Human Resources.
>
> **Current Status:** HR Approved
> **Next Stage:** [Next workflow stage label]
>
> Your submission will now proceed to the next stage of the performance assessment process.
>
> No further action is required from you at this stage unless the PMS requests it.

---

### 5. Board Approved (Final Approval)

**Trigger:** Board grants final approval — the submission has completed the full workflow.
**Recipient:** Employee

> Dear [Employee Name]
>
> We are pleased to inform you that your performance assessment submission has been approved by the Board.
>
> Your submission has successfully completed the required approval process.
>
> **Current Status:** Board Approved
> **Status:** Final Approval Completed
>
> Thank you for completing the performance assessment process.

---

### 6. Returned to Employee

**Trigger:** A reviewer returns the submission back to the employee for revision.
**Recipient:** Employee

> Dear [Employee Name]
>
> Your performance assessment submission has been returned to you for further review and action.
>
> **Current Status:** Returned to Employee
>
> Please log in to the Performance Management System, review the submission, make the required changes, and resubmit it when ready.
>
> Please ensure that all required information is complete before submitting again.
>
> **Return Reason:** [Reason provided by the reviewer, if any]

---

### 7. Returned to Manager 1

**Trigger:** Submission is returned to Manager 1 for further action.
**Recipient:** Manager 1 only (employee is NOT notified)

> Dear [Manager 1 Name]
>
> A performance assessment submission has been returned to you for further review and action.
>
> **Employee:** [Employee Name]
> **Current Status:** Returned to Manager 1
>
> Please log in to the Performance Management System, review the employee's submission, make the required changes or take the necessary action, and continue the assessment workflow.
>
> **Return Reason:** [Reason provided by the reviewer, if any]

---

### 8. Returned to Manager 2

**Trigger:** Submission is returned to Manager 2 for further action.
**Recipient:** Manager 2 only (employee is NOT notified)

> Dear [Manager 2 Name]
>
> A performance assessment submission has been returned to you for further review and action.
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
