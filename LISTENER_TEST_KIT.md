# Listener test kit

September 2026. This is the hands-on version of the plan in REFRAMING_WITH_MARKET_RESEARCH.md: what to say, what to write down, and in what order to do things.

## What the app can and cannot do today

I read the code. Three facts shape the test:

- The app plays a 30-second clip of a song when you tap play on its card. It does not move on to the next song by itself. So a session is a person tapping through a playlist, not sitting back and listening.
- The app keeps no record of what anyone does. Plays, hearts and removals are forgotten when the page closes.
- Every song already carries a region label (South India, Brazil, USA and so on). That is enough to tell "unfamiliar" from "familiar" for each person, as long as we ask them first which regions they already listen to.

So the work goes in two rounds. Round 1 needs no new code and can start this week. Round 2 needs the app to keep records.

## Round 1: five people, by hand, this week

The point of round 1 is to find out what is wrong with the test itself before spending 25 people on it. Five sessions, about 30 minutes each, on a laptop you bring with the app running. One person runs the session; the same person keeps the tally sheet.

### Who

Five people who are not family. Try for two heavy listeners (they make their own playlists), two casual listeners (they just press play), and one person who already listens to music in other languages.

### Message to recruit them

> I'm helping test a music app my son and I are building. It takes 30 minutes, in person. You pick how you feel, listen to some songs, and tell me what you think. No preparation needed, and there are no wrong answers. Are you free this week?

Do not mention "music from other cultures" in the invite. If people know what we hope to see, they will perform it.

### Session script

**Opening (1 minute).** Say: "We're testing the app, not you. If something is confusing or boring, that's the app's fault and I want to hear it. Please think out loud as you go."

**Before the app (10 minutes).** Ask, and write down the answers in their words:

1. Tell me about the last time you found a new artist you still listen to. How did that happen?
2. When did you last feel bored with your music? What did you do about it?
3. Do you ever listen to music in a language you don't speak? How did you come across it?
4. What do you pay for music now?
5. Which kinds of music do you listen to in a normal week? (Write these down carefully. They define what counts as "familiar" for this person.)

Do not react to the answers. No "oh great" when they mention foreign music. Just "tell me more."

**With the app (15 minutes).** Say: "Drag the dot to how you feel right now. Then play whatever you like from the list for about 15 minutes. Use the buttons however you want." Then stay quiet. Do not explain the buttons. Do not suggest songs. If they ask what something does, say "what would you expect it to do?" and note the question.

Fill in one line of the tally sheet for every song they play.

**Closing (4 minutes).** Ask:

1. Was there a song you'd want to hear again? Which one?
2. Was there a moment you wanted to stop? When?
3. If this were on your phone, when would you open it?

Then ask if you may check in with them in a week.

### Tally sheet (one per person)

Top of the sheet: name, date, listener type (heavy / casual / cross-language), kinds of music they said they normally listen to, the mood they picked.

One line for each song they play:

| # | Song | Region shown on the card | Familiar to them? (yes / no) | Played to the end of the clip? (yes / stopped early) | Button pressed (heart / 👎 remove / ⊘ never again / none) | Anything they said |
|---|---|---|---|---|---|---|

"Familiar" means the song's region or style matches what they told you in question 5. Decide this yourself; do not ask them mid-session.

### What to work out after five sessions

For each person, count two things separately for familiar and for unfamiliar songs: how many they stopped early or removed, out of how many they played. Put the ten numbers side by side. With five people this proves nothing yet. It tells you whether the gap looks small, large, or all over the place, and it shows what was awkward about the session so round 2 can be fixed before it starts.

Also write down: every question people asked about the app, every moment they looked lost, and whether 30-second clips felt like enough to judge a song.

## Round 2: 20–30 people, with the app keeping records

Round 2 needs a "test mode" built into the app. When switched on, it should:

- ask for a participant number at the start
- remember every play, how many seconds were heard, every heart and every removal, with the song's region
- let half the participants see a one-line reason on each song and the other half see none
- let half get a playlist with about 20% unfamiliar songs and the other half about 50%
- hand over everything as one spreadsheet file at the end of the session

Round 2 also needs the app reachable from a web address, so people can keep using it for the one-week follow-up. Today it only runs on a laptop that has the code.

The one-week follow-up questions: Did you open it again without being asked? Did you save or look up any artist you found through it? Did you tell anyone about it?

## Musician conversations

These can run alongside round 1. Eight to ten independent musicians, several singing in a language other than English. Thirty minutes each, by phone or in person.

1. Tell me about your last release. What did you do to get it heard?
2. What did that cost you, in hours and in money?
3. What came of it?
4. Where do your listeners come from now? How do you know?
5. Has anyone outside your language or country found your music? How?

Only then describe the idea in two sentences and ask: "If this put your song in front of 1,000 new listeners abroad, what would you want to happen next — more plays, more followers, or a way for them to pay you directly?"

## Order of work

1. Line up five people for round 1.
2. Run the five sessions with the script and tally sheet above.
3. Go over the five sheets together and fix the script.
4. Build test mode and put the app online.
5. Run round 2.
