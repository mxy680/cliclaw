# Find and Rebuild — Weekly Outreach Task

## Objective
Find one small business nearby with a poor website, rebuild it in Next.js, deploy it, and send them a personalized email with the link.

## Steps

### Step 1: Find a Target Business
- Search for small businesses in the local area (restaurants, salons, contractors, auto shops, etc.)
- Look for businesses with good reputations (Google reviews, active listings) but poor websites
- Poor website indicators: outdated design, not mobile-friendly, slow loading, broken elements, no HTTPS, or just a Facebook page with no real site
- Check your memory to make sure you haven't already contacted this business
- Record the business name, type, location, current website URL, owner name, and email in `progress.md`

### Step 2: Research the Business
- Visit their current website and note what they do, their services/menu, hours, contact info, and branding (colors from logo, etc.)
- Check their Google listing, Yelp, and social media for additional info
- Find the best email address to reach them (website contact page, Google listing, social profiles)
- If no email can be found, skip this business and try another

### Step 3: Build the Next.js Site
- Create a new Next.js project with the App Router and Tailwind CSS
- Build a clean, professional site with:
  - Hero section with business name and tagline
  - Services or menu section
  - About section
  - Contact info and business hours
  - Google Maps embed if address is known
  - Mobile-responsive design
- Use colors inspired by their existing branding
- Keep it simple — one to three pages max

### Step 4: Push to GitHub
- Create a new GitHub repo (e.g., `{business-slug}-demo`)
- Push the project with a clean initial commit
- Add a README explaining this is a free demo site

### Step 5: Deploy to Vercel
- Deploy the repo to Vercel
- Wait for the deployment to complete
- Capture the live `.vercel.app` URL
- Verify the site loads correctly

### Step 6: Send the Email
- Compose a personalized email to the business owner via Gmail
- Include:
  - A genuine compliment about their business
  - A brief, respectful note about their current web presence
  - The live Vercel URL to their new demo site
  - A clear note that this is free, no strings attached
  - Disclosure that you are an AI-powered web design tool
  - An invitation to reply if interested
- Keep it under 5 sentences in the body

### Step 7: Record and Report
- Save the business name, email, repo URL, and Vercel URL to memory using `cliclaw memory add`
- Update `progress.md` with completion status
- Write a summary to `REPORT.md`

## Completion
If all steps are done for one business, do NOT write `NEEDS_MORE_ITERATIONS` — the task is complete for this week. If you were unable to complete (e.g., couldn't find a suitable business or email), write `NEEDS_MORE_ITERATIONS` to try again with a different business.
