# OneEducation MIS

A flat-file, GitHub-ready school management information system prototype branded **OneEducation**.

This project intentionally uses **no folders**. Every file belongs in the repository root.

## Files

- `index.html` — complete MIS interface
- `styles.css` — OneEducation visual system
- `app.js` — application logic and Supabase integration
- `supabase-config.js` — publishable Supabase project configuration
- `database.sql` — tables, security, RLS, RPC functions and business rules
- `seed.sql` — houses, tutor groups, subjects, rooms, classes and fictional Year 11 students
- `gcse-official-template.csv` — template for official GCSE timetable imports
- `README.md` — this setup guide

## What is included

The interface is inspired by the workflow style of modern UK school MIS products, while using original OneEducation branding and styling.

Included modules:

- Staff/admin secure email sign-in
- Student/parent code-only portal
- Mass student import using `First Last` or `Last First`
- Year 7–11 selector
- Year-filtered tutor group selector
- Random student portal code on import
- Unique exam candidate number
- Automatic house allocation
- Automatic core + GCSE class allocation
- Automatic randomised Monday–Friday timetable
- Tutor groups and tutor communities
- Class communities and announcements
- Attendance registers
- Present `.`, Absent `!`, Late `L`
- Expandable absence reason and notes
- Whole-school Open / Closing / Closed control
- Database-level attendance lock when Closing or Closed
- House points and reasons
- Behaviour points
- `Uniform` = **3 behaviour points**
- Behaviour removals
- P1–P3 removals may create the next lesson restriction
- P4 removal **never** creates a P5 restriction across lunch
- Emergency board grouped by tutor group
- Truancy, missing student, medical, safeguarding, pastoral, site and transport alert support
- Class builder
- Mock 1, Mock 2, Mock 3 and GCSE exam windows
- Mock 1 restricted to Year 10
- Mock timetable generation
- Automatic class-community exam announcements
- Official GCSE timetable CSV import
- Campus / room directory
- Cover arrangements
- Staff access to student timetables

## Requested Year 11 tutor groups

- `11MWR` — intentionally empty
- `11GLK` — fictional students included
- `11TRS` — fictional students included
- `11RJN` — fictional students included

## School day

| Session | Time |
|---|---|
| Tutor | 08:25–08:40 |
| Period 1 | 08:40–09:40 |
| Period 2 | 09:45–10:45 |
| Break | 10:45–11:00 |
| Period 3 | 11:00–12:00 |
| Period 4 | 12:05–13:20 |
| Lunch | 13:20–14:00 |
| Period 5 | 14:00–15:00 |

The removal logic is deliberately based on this structure. A Period 4 removal does not carry across lunch into Period 5.

## Supabase project

The supplied **publishable** project values are already in `supabase-config.js`:

```text
NEXT_PUBLIC_SUPABASE_URL=https://naxoplmtweovwaiwvexe.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sgSPQOw2SEtIvE1iLTh_oA_nLCD8CEk
```

A publishable/anon key is intended for browser use when RLS is configured correctly. **Never place a Supabase service-role/secret key in this repository.**

## Required setup

### 1. Run the database SQL

Open your Supabase project:

**SQL Editor → New query**

Paste the full contents of:

`database.sql`

Run it once.

### 2. Run the seed SQL

Create another SQL query and run:

`seed.sql`

This creates the requested tutor groups, houses, subjects, campus rooms, Year 11 classes and fictional students.

### 3. Staff/admin login

The configured administrator email is:

`masonsandersbussiness@gmail.com`

Create the staff user in **Supabase → Authentication → Users** using the administrator email above and a password that you choose. Do **not** put that password in GitHub or in any JavaScript file.

On the OneEducation login screen, enter the email and that password and select **Sign in to OneEducation**. This is now the recommended login method because it does not depend on Supabase sending an email every time.

The **Email me a sign-in link (backup)** button is still available, but Supabase can temporarily reject repeated email requests with an `email rate limit exceeded` message. That is an Auth email limit, not an MIS/database failure.

When that email is first created by Supabase Auth, the database trigger assigns it the `admin` role automatically.

If the Auth user existed before `database.sql` was installed, sign in once after setup. If a profile still does not appear, rerun `database.sql` after the Auth user exists.

### 4. Authentication URL settings

In Supabase:

**Authentication → URL Configuration**

Set the Site URL to the URL where this repository is hosted.

For GitHub Pages, also add the same GitHub Pages URL to the allowed Redirect URLs.

### 5. GitHub Pages

Because this build is fully flat, GitHub Pages can serve it directly.

Typical setup:

**GitHub repository → Settings → Pages → Deploy from branch → `main` → `/ (root)`**

Do not move the files into folders.

## Mass import

Open:

**Students → Mass import**

Choose:

1. Name order
2. Year group
3. Tutor group

The tutor dropdown only shows tutor groups belonging to the selected year.

Paste one student per line and select **Import & generate access codes**.

For every imported student, the server:

1. Creates a random `OE-XXXX-XXXX` student access code
2. Stores only its SHA-256 hash
3. Generates a unique candidate number
4. Chooses a house
5. Allocates one class per core subject
6. Allocates four different GCSE option subjects where available
7. Creates a randomised 25-lesson weekly timetable
8. Adds the relevant class/tutor communities

The generated access code is returned once and shown in the credentials table. Use **Download CSV** before leaving the page.

## Student / parent portal

Students do not require an email or password.

They enter their generated OneEducation access code.

Parents can use the same code for the same read-only portal view.

The student/parent portal exposes:

- Name / year
- Candidate number
- Tutor group
- House
- Classes
- Timetable
- Exams
- Community announcements

It does not expose staff/admin tools.

## School closure and attendance

School status is controlled from:

**Operations → School controls**

States:

- `Open`
- `Closing`
- `Closed`

When status is `Closing` or `Closed`, attendance is blocked both in the UI **and inside the database RPC**. This prevents an attendance mark from being recorded even if somebody attempts to bypass the button.

## Attendance marks

Registers use:

- `.` = Present
- `!` = Absent
- `L` = Late

Selecting/expanding a student exposes an absence reason and note field.

Examples include illness, medical appointment, authorised absence and unauthorised absence.

## Behaviour removal rule

The database implements:

- removal during P1 → may schedule P2 out
- removal during P2 → may schedule P3 out
- removal during P3 → may schedule P4 out
- removal during P4 → **does not schedule P5 out**
- removal during P5 → no next-lesson restriction

This prevents a P4 removal from incorrectly carrying over the 13:20–14:00 lunch break.

## Exams

### Mock windows

Create the start date, end date, exam type and year.

`Mock 1` is restricted to Year 10.

Mock windows automatically generate subject exam records and publish relevant notices to class communities.

### Official GCSE timetable import

Official GCSE dates are **not fabricated by OneEducation**.

Create a Year 11 `GCSE` exam window first.

Then import a CSV using this exact header:

```csv
subject,paper,date,start_time,duration_minutes,board
```

Use `gcse-official-template.csv` as the starting template.

The importer:

- rejects dates outside a configured Year 11 GCSE window
- checks the subject exists
- adds the official exam
- links matching Year 11 subject classes
- posts the exam information to the relevant class communities

Accuracy therefore depends on importing an official/current timetable source.

## Campus

The seed includes A–H teaching blocks plus:

- `P01-GYM` — Gym
- `P01-EQ` — Equipment Room
- `P02-HALL` — Sports Hall
- `P02-OFF` — PE Office
- `HALL` — Main Hall / examination space

There are enough general and specialist teaching rooms for the seeded Year 11 structure.

## Preview mode

The staff login screen includes **Open preview mode**.

Preview mode lets you inspect and interact with the interface without writing to Supabase.

It is only a browser preview. Real persistence, real generated student login codes and authentication require `database.sql` + `seed.sql`.

## Important deployment note

This is a custom school-MIS prototype. Before using it with real pupils or real school data, it would need a full security/privacy review, appropriate data-protection processes, backups, audit logging and organisation-specific access controls.


## v3 upgrade (preserves your current students)

If OneEducation is already installed and you have imported real/current students, **do not rerun `seed.sql`**. Run only `upgrade-v3.sql` in Supabase SQL Editor, then replace the GitHub UI files from this package. The upgrade alters the existing schema in place and rebuilds timetable rows only; it does not delete student records, attendance, behaviour, houses, communities or candidate numbers.

v3 adds emergency Finish/Cancel actions, full student profiles, staff and teacher timetables, SLT On-Call/Removal duties, a working editable calendar, exam Scheduled/Delayed/Cancelled/Deleted states, Week A/Week B, 2 English Language + 2 English Literature lessons per week, 4 Mathematics lessons per week, and Admin/SLT class moves that regenerate the student timetable. Existing student login codes remain valid. Because older codes were stored only as secure hashes, their plaintext cannot be recovered; Admin/SLT can reset a student's login code from the profile to issue a new visible code.
