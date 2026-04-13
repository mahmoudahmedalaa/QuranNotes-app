import { readFileSync } from 'fs';
import nodemailer from 'nodemailer';

const GMAIL_USER = 'qurannotesapp@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const SUBJECT = 'Why I was forced to pause (and what I built)';
const OFFER_LINK = 'https://apps.apple.com/redeem?ctx=offercodes&id=6758863558&code=NOOR50';

if (!GMAIL_APP_PASSWORD) {
    console.error('❌ ERROR: GMAIL_APP_PASSWORD is not set. Please set the environment variable first!');
    console.error('Example: export GMAIL_APP_PASSWORD="your-app-password"');
    process.exit(1);
}

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <div style="display: flex; align-items: center; margin-bottom: 24px;">
        <img src="cid:logo" width="32" height="32" style="border-radius: 6px; margin-right: 12px; vertical-align: middle;">
        <span style="font-weight: 600; font-size: 15px; color: #555555;">QuranNotes App Update</span>
    </div>

    <h1 style="font-size: 24px; color: #111111; margin-bottom: 24px;">Why I was forced to pause (and what I built)</h1>

    <p>Hey everyone,</p>

    <p>I want to share a quick, personal story about how our newest update actually came to be.</p>

    <p>A while back, I was back in the Middle East, living out a lifelong dream working in top-tier <strong>Management Consulting</strong>.</p>

    <p>It was the classic corporate grind. I was working crazy hours, living out of suitcases, and had very little time for anything else. Because of the constant traveling, my connection to religion had become incredibly on-and-off. I was always promising myself I'd "get back on track later," but the treadmill never stopped.</p>

    <h3 style="font-size: 18px; color: #111111; margin-top: 32px; border-bottom: 1px solid #eeeeee; padding-bottom: 8px;">The Wake-Up Call</h3>

    <p>Then, two things forced me to completely re-evaluate everything:</p>

    <ol style="margin-bottom: 24px;">
        <li style="margin-bottom: 8px;"><strong>The Regional Crisis:</strong> Watching the devastating situation unfold in the Middle East instantly broke open my perspective on what actually matters in this life.</li>
        <li style="margin-bottom: 8px;"><strong>The Breaking Point:</strong> I tore my meniscus.</li>
    </ol>

    <p>Suddenly, I needed knee surgery. The guy who never had time to pause couldn't even walk. I was completely stuck on the couch.</p>

    <div style="text-align: center; margin: 32px 0;">
        <img src="cid:img_8672" alt="Surgery Recovery" width="280" style="border-radius: 12px; width: 280px; max-width: 100%; height: auto;">
    </div>

    <p style="font-style: italic; color: #555555; background: #f9f9f9; padding: 16px; border-left: 4px solid #8b5cf6;">It felt like a very clear message from the universe: "You needed a pause. Here it is."</p>

    <h3 style="font-size: 18px; color: #111111; margin-top: 32px; border-bottom: 1px solid #eeeeee; padding-bottom: 8px;">Building the Foundation</h3>

    <p>So, I set up my laptop and started coding a tool to solve my own problem: how to stay consistent with the Quran and Adhkar when life gets overwhelming.</p>

    <p>That downtime is exactly how the first version of <strong>QuranNotes</strong> was born.</p>

    <div style="text-align: center; margin: 32px 0;">
        <img src="cid:img_9203" alt="Workspace Setup" width="280" style="border-radius: 12px; width: 280px; max-width: 100%; height: auto;">
    </div>

    <p>It helped with consistency, but eventually, I hit another massive wall: <strong>Understanding.</strong></p>

    <p>When I read an Ayah and had a deep question, asking people was intimidating. When I did ask, I usually got incomplete or "whatever" answers. I couldn't just use ChatGPT either, because general AIs hallucinate and confidently invent fatwas, which is incredibly dangerous.</p>

    <h3 style="font-size: 18px; color: #111111; margin-top: 32px; border-bottom: 1px solid #eeeeee; padding-bottom: 8px;">The Breakthrough: Noor AI</h3>

    <p>So for the last few months, I've been building <strong>Noor AI</strong>.</p>

    <p>I programmed it entirely differently. It is built on a custom, highly-constrained <strong>RAG (Retrieval-Augmented Generation)</strong> pipeline.</p>

    <p>Here is exactly how it works under the hood:</p>
    <ul style="margin-bottom: 24px;">
        <li style="margin-bottom: 8px;">When you ask a question, Noor doesn't rely on generic AI knowledge.</li>
        <li style="margin-bottom: 8px;">Instead, it runs a semantic vector-search against a highly curated database containing only the authenticated classical texts of <strong>Ibn Kathir</strong> and <strong>Al-Sa'di</strong>.</li>
        <li style="margin-bottom: 8px;">We explicitly programmed a strict constraint: <strong>if the answer isn't firmly written in those two Tafsirs, Noor will refuse to answer rather than guess.</strong></li>
        <li style="margin-bottom: 8px;">Once it extracts the exact scholarly consensus, it synthesizes it so it's easy to read, and <strong>hyperlinks the exact Ayah</strong> so you can verify the source in the Quran yourself.</li>
    </ul>

    <p>No guessing. Just grounded, scholarly answers right in your pocket.</p>

    <div style="text-align: center; margin: 32px 0;">
        <img src="cid:screenshot" alt="Noor AI Verified Answer" width="280" style="border-radius: 12px; border: 1px solid #eeeeee; width: 280px; max-width: 100%; height: auto;">
    </div>

    <h3 style="font-size: 18px; color: #111111; margin-top: 32px; border-bottom: 1px solid #eeeeee; padding-bottom: 8px;">The Next Chapter</h3>

    <p>This update has fundamentally changed how I interact with the Quran, and I cannot wait for you to try it.</p>

    <p>Because you've supported this app from the early days, I set up a custom promo code for you. Use code <strong>NOOR50</strong> (or click the link below) to get <strong>50% off your first year of QuranNotes Pro</strong>, unlocking unlimited Noor AI access.</p>

    <div style="text-align: center; margin: 32px 0;">
        <a href="${OFFER_LINK}" style="display: inline-block; background-color: #8b5cf6; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px;">Claim 50% Off Promo Code &rarr;</a>
    </div>

    <p>Thanks for being on this journey with me.</p>

    <p style="margin-bottom: 32px;">— Mahmoud</p>

    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 32px 0;">

    <p style="font-size: 14px; color: #666666; text-align: center;">
        &#128241; <em>P.S. I share weekly tips and document everything I build over on TikTok. <a href="https://www.tiktok.com/@qurannotesapp" style="color: #8b5cf6;">Let's connect there!</a></em>
    </p>

</body>
</html>
`;

function loadImg(p) {
    try {
        return Buffer.from(readFileSync(p)).toString('base64');
    } catch (e) {
        console.error('Missing image:', p);
        return null;
    }
}

const attachments = [];

const logo = loadImg('/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp/assets/icon.png');
if (logo) attachments.push({ filename: 'icon.png', content: logo, encoding: 'base64', cid: 'logo' });

const img1 = loadImg('/Users/mahmoudalaaeldin/.gemini/antigravity/brain/8d99e7e6-5a21-4638-8c6f-b911eba71dbc/IMG_8672.jpg');
if (img1) attachments.push({ filename: 'IMG_8672.jpg', content: img1, encoding: 'base64', cid: 'img_8672' });

const img2 = loadImg('/Users/mahmoudalaaeldin/.gemini/antigravity/brain/8d99e7e6-5a21-4638-8c6f-b911eba71dbc/IMG_9203.jpg');
if (img2) attachments.push({ filename: 'IMG_9203.jpg', content: img2, encoding: 'base64', cid: 'img_9203' });

const img3 = loadImg('/Users/mahmoudalaaeldin/Downloads/Screenshot 2026-04-11 at 12.23.59 PM.png');
if (img3) attachments.push({ filename: 'screenshot.png', content: img3, encoding: 'base64', cid: 'screenshot' });


async function run() {
    // 1. Read Emails
    let emailsFile;
    try {
        emailsFile = readFileSync('/Users/mahmoudalaaeldin/Documents/Projects/VibeCoding/Projects/QuranApp/docs/Marketing/campaigns/qurannotes_marketing_emails.txt', 'utf8');
    } catch (e) {
        console.error('Could not find emails file!');
        process.exit(1);
    }

    // Split by comma or new line
    const emails = emailsFile.split(/[\n,]+/).map(e => e.trim()).filter(e => e.includes('@'));
    console.log('📦 Found ' + emails.length + ' verified users to send to.');

    // 2. Configure Nodemailer
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_APP_PASSWORD
        }
    });

    console.log('🚀 Beginning broadcast...');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        try {
            console.log('[' + (i + 1) + '/' + emails.length + '] Sending to ' + email + '...');
            await transporter.sendMail({
                from: '"Mahmoud from QuranNotes" <' + GMAIL_USER + '>',
                to: email,
                subject: SUBJECT,
                html: htmlTemplate,
                attachments: attachments
            });
            successCount++;

            // Wait 2 seconds between emails to avoid Gmail rate limits
            await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
            console.error('❌ Failed to send to ' + email + ': ', err.message);
            failCount++;
        }
    }

    console.log('\n✅ Broadcast Complete!');
    console.log('Successfully sent: ' + successCount);
    console.log('Failed: ' + failCount);
}

run();
