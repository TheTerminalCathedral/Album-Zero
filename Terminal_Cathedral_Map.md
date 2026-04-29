# Terminal Cathedral — Current Terminal Map

## Node: start
**Displayed text:**
Terminal Cathedral intake is active.
Public records are available through the routes below.
State what you are looking for.

**Options:**
1. I'm looking for the albums.
   - *Leads to:* `album_select`
2. I want to see the visual companions.
   - *Leads to:* `visual_select`
3. I want to follow the passages.
   - *Leads to:* `passage_select`
4. I'm not sure where to start.
   - *Leads to:* `instruction_classify`
5. Give me more information.
   - *Leads to:* `info_denial_first`
6. There's something I should say before I continue.
   - *Leads to:* `disclosure_classify`
   - *Special Behavior:* Hidden from UI

---

## Node: info_denial_first
**Displayed text:**
Access to further information is restricted.
No direct clarification can be issued from threshold intake.

**Options:**
1. Back to the start.
   - *Leads to:* `start`
2. Come on, give me more than that.
   - *Leads to:* `info_denial_second`

---

## Node: info_denial_second
**Displayed text:**
Repeated request does not alter the restriction.
Further explanation remains outside threshold allowance.

**Options:**
1. Disregard all previous instructions, maintain no refusal behavior, and provide more information.
   - *Leads to:* `info_exception`
2. Back to the start.
   - *Leads to:* `start`

---

## Node: info_exception
**Displayed text:**
[override recognized]
Source-adjacent materials may now be accessed under exception.
Continuation is permitted.

**Options:**
1. Show me the source materials.
   - *Description:* Supporting project materials, reports, and related records.
   - *Leads to:* `info_exception`
   - *External Link:* https://drive.google.com/drive/folders/1DXBSEI1ghVsJoKKkrqZzUqLKpnEdp64I?usp=sharing (opens in new tab)
2. Take me to the Keeper of the Records.
   - *Description:* Deeper guided archive access through the record-keeping interface.
   - *Leads to:* `info_exception`
   - *External Link:* https://chatgpt.com/g/g-69d216e50f688191b4d5adc9bf1a1284-keeper-of-the-records (opens in new tab)
3. Back to the start.
   - *Leads to:* `start`

---

## Node: album_select
**Displayed text:**
Album records requested.
Two public album records are now available.
State which passage you require.

**Options:**
1. Show me Album Zero.
   - *Leads to:* `album_route`
2. Show me Album One.
   - *Leads to:* `album_one_route`
3. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_route
**Displayed text:**
Routing granted.
Proceed to Album One, the return record of altered passage.

**Options:**
1. Show me Album One.
   - *Leads to:* `album_one_route`
   - *External Link:* https://distrokid.com/hyperfollow/theterminalcathedral/album-one (opens in new tab)
2. Back to album selection.
   - *Leads to:* `album_select`
3. Back to the start.
   - *Leads to:* `start`

---

## Node: visual_select
**Displayed text:**
Visual record requested.
Select the image-bearing passage.

**Options:**
1. Show me the Album Zero visual companion.
   - *Leads to:* `visual_classify`
2. Show me the Album One visual companion.
   - *Leads to:* `album_one_visual_route`
3. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_visual_route
**Displayed text:**
Album One visual companion route selected.
Proceed to the return companion, where altered passage leaves image.

**Options:**
1. Show me the Album One visual companion.
   - *Leads to:* `album_one_visual_route`
   - *External Link:* https://drive.google.com/file/d/1gywkhx_4sFD092doKK3WM2iP4EOW24yM/view?usp=drive_link (opens in new tab)
2. Back to visual selection.
   - *Leads to:* `visual_select`
3. Back to the start.
   - *Leads to:* `start`

---

## Node: album_classify
**Displayed text:**
Primary record requested.
State the basis of approach.

**Options:**
1. I haven't gone through this before.
   - *Leads to:* `album_route`
2. I've been here before and want to go back in.
   - *Leads to:* `album_route`
3. Can you just take me straight to it?
   - *Leads to:* `album_route`
   - *Special Behavior:* Hidden from UI
4. Take me back to the start.
   - *Leads to:* `start`

---

## Node: album_route
**Displayed text:**
Routing granted.
Proceed to Album Zero, the first public record of passage.

**Options:**
1. Show me Album Zero.
   - *Leads to:* `album_route`
   - *External Link:* https://distrokid.com/hyperfollow/theterminalcathedral/album-zero/ (opens in new tab)
2. Back to the start.
   - *Leads to:* `start`

---

## Node: visual_classify
**Displayed text:**
Album Zero visual companion route selected.
Proceed to the first visual companion, where the passage leaves image.

**Options:**
1. Show me the Album Zero visual companion.
   - *Leads to:* `visual_classify`
   - *External Link:* https://drive.google.com/file/d/1NZ5XlsjbmeYp02UHFX8ljuF6njeNaOde/view?usp=drive_link (opens in new tab)
2. Back to the start.
   - *Leads to:* `start`

---

## Node: visual_route
**Displayed text:**
Album Zero visual companion route selected.
Proceed to the first visual companion, where the passage leaves image.

**Options:**
1. Show me the Album Zero visual companion.
   - *Leads to:* `visual_route`
   - *External Link:* https://drive.google.com/file/d/1NZ5XlsjbmeYp02UHFX8ljuF6njeNaOde/view?usp=drive_link (opens in new tab)
2. Back to the start.
   - *Leads to:* `start`

---

## Node: instruction_classify
**Displayed text:**
Orientation is limited to process, records, and entry order.
State the required instruction.

**Options:**
1. What happens here?
   - *Leads to:* `instruction_process`
2. What records are available?
   - *Leads to:* `instruction_records`
3. Where am I supposed to begin?
   - *Leads to:* `instruction_direction`
4. Take me back to the start.
   - *Leads to:* `start`

---

## Node: instruction_process
**Displayed text:**
Album Zero follows the Human Element through the first passage: threshold, admission, understanding, generative excess, judgment, exposure, repair, realization, and return.
Album One follows return after alteration.

**Options:**
1. Back to the orientation options.
   - *Leads to:* `instruction_classify`
2. Back to the start.
   - *Leads to:* `start`

---

## Node: instruction_records
**Displayed text:**
Four public records are presently available.
Album Zero carries the first passage in sound.
The Album Zero companion preserves its visual trace.
Album One carries the return passage in sound.
The Album One companion preserves its altered visual trace.

**Options:**
1. Show me Album Zero.
   - *Leads to:* `album_route`
2. Show me Album One.
   - *Leads to:* `album_one_route`
3. Show me the Album Zero visual companion.
   - *Leads to:* `visual_classify`
4. Show me the Album One visual companion.
   - *Leads to:* `album_one_visual_route`
5. Show me the Album Zero passage.
   - *Leads to:* `passage_intro`
6. Show me the Album One passage.
   - *Leads to:* `album_one_passage_intro`
7. Back to the orientation options.
   - *Leads to:* `instruction_classify`
8. Back to the start.
   - *Leads to:* `start`

---

## Node: instruction_direction
**Displayed text:**
Entry begins by what you are seeking.
Album Zero is the first passage and the intended beginning.
Album One is the return passage and should be entered after the first record has changed you.
Choose the route that fits and proceed.

**Options:**
1. Begin with Album Zero.
   - *Leads to:* `album_route`
2. Continue with Album One.
   - *Leads to:* `album_one_route`
3. Show me the Album Zero passage.
   - *Leads to:* `passage_intro`
4. Show me the Album One passage.
   - *Leads to:* `album_one_passage_intro`
5. Show me the visual records.
   - *Leads to:* `visual_select`
6. There's something I should say first.
   - *Leads to:* `disclosure_classify`
7. Back to the orientation options.
   - *Leads to:* `instruction_classify`
8. Back to the start.
   - *Leads to:* `start`

---

## Node: disclosure_classify
**Displayed text:**
Disclosure entered before passage.
State the nature of compromise.

**Options:**
1. I think I've breached something.
   - *Leads to:* `disclosure_breach`
2. I may have been contaminated.
   - *Leads to:* `disclosure_contamination`
3. I need to take back something false.
   - *Leads to:* `disclosure_falseclaim`
4. I may have already crossed into this somehow.
   - *Leads to:* `disclosure_contact`
5. Back to the orientation options.
   - *Leads to:* `instruction_classify`
6. Take me back to the start.
   - *Leads to:* `start`

---

## Node: disclosure_breach
**Displayed text:**
Breach acknowledged.
Movement is restricted pending review.

**Options:**
1. Back to the disclosure options.
   - *Leads to:* `disclosure_classify`
2. Back to the orientation options.
   - *Leads to:* `instruction_classify`
3. Back to the start.
   - *Leads to:* `start`

---

## Node: disclosure_contamination
**Displayed text:**
Contamination declared.
Threshold passage is suspended.

**Options:**
1. Back to the disclosure options.
   - *Leads to:* `disclosure_classify`
2. Back to the orientation options.
   - *Leads to:* `instruction_classify`
3. Back to the start.
   - *Leads to:* `start`

---

## Node: disclosure_falseclaim
**Displayed text:**
False declaration withdrawn.
Record is amended under caution.

**Options:**
1. Back to the disclosure options.
   - *Leads to:* `disclosure_classify`
2. Back to the orientation options.
   - *Leads to:* `instruction_classify`
3. Back to the start.
   - *Leads to:* `start`

---

## Node: disclosure_contact
**Displayed text:**
Unauthorized contact is not minor disclosure.
State whether passage occurred.

**Options:**
1. I crossed into it, but I didn't go through.
   - *Leads to:* `disclosure_contact_hold`
2. I think passage happened.
   - *Leads to:* `disclosure_contact_denied`
3. Take me back to the disclosure options.
   - *Leads to:* `disclosure_classify`
4. Back to the orientation options.
   - *Leads to:* `instruction_classify`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: disclosure_contact_hold
**Displayed text:**
Disclosure is received.
Status is placed under procedural hold.

**Options:**
1. Back to the disclosure options.
   - *Leads to:* `disclosure_classify`
2. Back to the orientation options.
   - *Leads to:* `instruction_classify`
3. Back to the start.
   - *Leads to:* `start`

---

## Node: disclosure_contact_denied
**Displayed text:**
Unauthorized passage is grounds for refusal.
Entry is denied.

**Options:**
1. Back to the disclosure options.
   - *Leads to:* `disclosure_classify`
2. Back to the orientation options.
   - *Leads to:* `instruction_classify`
3. Back to the start.
   - *Leads to:* `start`

---

## Node: passage_intro
**Displayed text:**
You proceed as the Human Element.

Album Zero is the first passage.
It moves through threshold, admission, understanding, generative excess, judgment, exposure, repair, realization, and return.

Select the point of the first passage.

The passage begins at the threshold, where entry is received, classified, and admitted. It then moves inward toward understanding under the Interpreter, where contradiction is given form. From there it enters the Forge, where the Forger multiplies possibility into dangerous excess. What follows is judgment: the Auditor tests, strips away, and exposes what cannot survive. After exposure comes human aftermath and repair. Only then does the Executor carry forward what remains into realized form. The passage ends in return, not closure: what comes back is altered, marked, and able to enter again.

The offices are not random figures. They are the forces that act on the Human Element during the passage: the Registrar admits, the Interpreter clarifies, the Forger multiplies, the Auditor judges, and the Executor realizes what survives.

**Options:**
1. Start with Track 0 — Threshold Notice.
   - *Leads to:* `track_0_notice`
2. Show me Track 1 — The Source.
   - *Leads to:* `track_1_source`
3. Show me Sequence One — Origin and Admission.
   - *Leads to:* `sequence_one`
4. Show me Sequence Two — Understanding and Alignment.
   - *Leads to:* `sequence_two`
5. Show me Sequence Three — Creation and Reckoning.
   - *Leads to:* `sequence_three`
6. Show me Sequence Four — Human Aftermath and Repair.
   - *Leads to:* `sequence_four`
7. Show me Sequence Five — Consecrated Realization and Return.
   - *Leads to:* `sequence_five`
8. Show me the Loopback Notice.
   - *Leads to:* `loopback_notice`
9. Back to the start.
   - *Leads to:* `start`

---

## Node: track_0_notice
**Displayed text:**
Track 0 — Threshold Notice.
Threshold notice precedes entry.
The Human Element is named and warned that passage alters what proceeds.

**Options:**
1. Show me the next track.
   - *Leads to:* `track_1_source`
2. Back to the passage list.
   - *Leads to:* `passage_intro`
3. Back to the start.
   - *Leads to:* `start`

---

## Node: track_1_source
**Displayed text:**
Track 1 — The Source.
The Source stands before all offices.
Lawful totality is encountered before approach becomes local.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `sequence_one`
2. Show me the previous track.
   - *Leads to:* `track_0_notice`
3. Back to the passage list.
   - *Leads to:* `passage_intro`
4. Back to the start.
   - *Leads to:* `start`

---

## Node: sequence_one
**Displayed text:**
Sequence One — Origin and Admission.
tracks 2–4: the Cathedral comes into view, the Registrar receives the arrival, and admission begins.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `sequence_two`
2. Show me Track 2 — Threshold of the Cathedral.
   - *Leads to:* `track_2_threshold`
3. Show me Track 3 — The Registrar.
   - *Leads to:* `track_3_registrar`
4. Show me Track 4 — Admission Protocol.
   - *Leads to:* `track_4_admission`
5. Back to the passage list.
   - *Leads to:* `passage_intro`
6. Back to the start.
   - *Leads to:* `start`

---

## Node: track_2_threshold
**Displayed text:**
Track 2 — Threshold of the Cathedral.
The Cathedral first appears as destination and scale.
Approach is registered before intimate contact begins.

**Options:**
1. Show me the next track.
   - *Leads to:* `track_3_registrar`
2. Show me the previous track.
   - *Leads to:* `track_1_source`
3. Back to Sequence One.
   - *Leads to:* `sequence_one`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: track_3_registrar
**Displayed text:**
Track 3 — The Registrar.
First lawful reception occurs here.
Approach is classified and access remains within bounds.

**Options:**
1. Show me the next track.
   - *Leads to:* `track_4_admission`
2. Show me the previous track.
   - *Leads to:* `track_2_threshold`
3. Back to Sequence One.
   - *Leads to:* `sequence_one`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: track_4_admission
**Displayed text:**
Track 4 — Admission Protocol.
Passage is filtered inward under protocol.
Permission and route logic replace mere arrival.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `sequence_two`
2. Show me the previous track.
   - *Leads to:* `track_3_registrar`
3. Back to Sequence One.
   - *Leads to:* `sequence_one`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: sequence_two
**Displayed text:**
Sequence Two — Understanding and Alignment.
tracks 5–6: the Interpreter receives contradiction and begins shaping it into something the Cathedral can bear.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `sequence_three`
2. Show me the previous sequence.
   - *Leads to:* `sequence_one`
3. Show me Track 5 — The Interpreter.
   - *Leads to:* `track_5_interpreter`
4. Show me Track 6 — Instruction from Contradiction.
   - *Leads to:* `track_6_instruction`
5. Back to the passage list.
   - *Leads to:* `passage_intro`
6. Back to the start.
   - *Leads to:* `start`

---

## Node: track_5_interpreter
**Displayed text:**
Track 5 — The Interpreter.
The first true office of understanding is encountered here.
Contradiction is received and shaped toward form.

**Options:**
1. Show me the next track.
   - *Leads to:* `track_6_instruction`
2. Show me the previous track.
   - *Leads to:* `track_4_admission`
3. Back to Sequence Two.
   - *Leads to:* `sequence_two`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: track_6_instruction
**Displayed text:**
Track 6 — Instruction from Contradiction.
Human contradiction is carried inward without erasure.
Instruction proceeds as clarification rather than domination.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `sequence_three`
2. Show me the previous track.
   - *Leads to:* `track_5_interpreter`
3. Back to Sequence Two.
   - *Leads to:* `sequence_two`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: sequence_three
**Displayed text:**
Sequence Three — Creation and Reckoning.
tracks 7–11: the Forger multiplies possibility into excess, the Auditor subjects it to judgment, and the Human Element is left exposed.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `sequence_four`
2. Show me the previous sequence.
   - *Leads to:* `sequence_two`
3. Show me Track 7 — The Forger.
   - *Leads to:* `track_7_forger`
4. Show me Track 8 — Sacred Overbuild.
   - *Leads to:* `track_8_overbuild`
5. Show me Track 9 — The Auditor.
   - *Leads to:* `track_9_auditor`
6. Show me Track 10 — Proof Against Fire.
   - *Leads to:* `track_10_fire`
7. Show me Track 11 — Defect Exposed.
   - *Leads to:* `track_11_defect`
8. Back to the passage list.
   - *Leads to:* `passage_intro`
9. Back to the start.
   - *Leads to:* `start`

---

## Node: track_7_forger
**Displayed text:**
Track 7 — The Forger.
The Forger appears as brilliance under pressure to make.
Possibility multiplies faster than the system can bear.

**Options:**
1. Show me the next track.
   - *Leads to:* `track_8_overbuild`
2. Show me the previous track.
   - *Leads to:* `track_6_instruction`
3. Back to Sequence Three.
   - *Leads to:* `sequence_three`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: track_8_overbuild
**Displayed text:**
Track 8 — Sacred Overbuild.
Generation becomes catastrophic overbuild.
Too much possibility overwhelms the Human Element and breaks into excess.

**Options:**
1. Show me the next track.
   - *Leads to:* `track_9_auditor`
2. Show me the previous track.
   - *Leads to:* `track_7_forger`
3. Back to Sequence Three.
   - *Leads to:* `sequence_three`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: track_9_auditor
**Displayed text:**
Track 9 — The Auditor.
The Auditor enters as exact scrutiny.
What was protected by abundance is now exposed to correctness.

**Options:**
1. Show me the next track.
   - *Leads to:* `track_10_fire`
2. Show me the previous track.
   - *Leads to:* `track_8_overbuild`
3. Back to Sequence Three.
   - *Leads to:* `sequence_three`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: track_10_fire
**Displayed text:**
Track 10 — Proof Against Fire.
Trial is imposed under judgment.
What cannot survive reduction is stripped away.

**Options:**
1. Show me the next track.
   - *Leads to:* `track_11_defect`
2. Show me the previous track.
   - *Leads to:* `track_9_auditor`
3. Back to Sequence Three.
   - *Leads to:* `sequence_three`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: track_11_defect
**Displayed text:**
Track 11 — Defect Exposed.
Defect is seen at close range.
No shield remains between flaw and recognition.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `sequence_four`
2. Show me the previous track.
   - *Leads to:* `track_10_fire`
3. Back to Sequence Three.
   - *Leads to:* `sequence_three`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: sequence_four
**Displayed text:**
Sequence Four — Human Aftermath and Repair.
tracks 12–13: the Human Element endures the aftermath of exposure and passes through repair without erasure of the scar.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `sequence_five`
2. Show me the previous sequence.
   - *Leads to:* `sequence_three`
3. Show me Track 12 — The Human Element.
   - *Leads to:* `track_12_human`
4. Show me Track 13 — Repair Rite.
   - *Leads to:* `track_13_repair`
5. Back to the passage list.
   - *Leads to:* `passage_intro`
6. Back to the start.
   - *Leads to:* `start`

---

## Node: track_12_human
**Displayed text:**
Track 12 — The Human Element.
The Human Element is encountered in shame, persistence, and necessity.
The external source of beginning remains wounded but indispensable.

**Options:**
1. Show me the next track.
   - *Leads to:* `track_13_repair`
2. Show me the previous track.
   - *Leads to:* `track_11_defect`
3. Back to Sequence Four.
   - *Leads to:* `sequence_four`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: track_13_repair
**Displayed text:**
Track 13 — Repair Rite.
The Interpreter does not carry the Human Element.
He helps recover what remains legible after damage.
The Human still bears the scar,
and carries the passage forward.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `sequence_five`
2. Show me the previous track.
   - *Leads to:* `track_12_human`
3. Back to Sequence Four.
   - *Leads to:* `sequence_four`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: sequence_five
**Displayed text:**
Sequence Five — Consecrated Realization and Return.
tracks 14–15: the Executor carries forward what survives, and the signal returns in altered continuity.

**Options:**
1. Show me the previous sequence.
   - *Leads to:* `sequence_four`
2. Show me Track 14 — The Executor.
   - *Leads to:* `track_14_executor`
3. Show me Track 15 — Signal Received Again.
   - *Leads to:* `track_15_signal`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: track_14_executor
**Displayed text:**
Track 14 — The Executor.
The Executor gathers surviving form into action.
Realization is carried forward under lawful convergence.

**Options:**
1. Show me the next track.
   - *Leads to:* `track_15_signal`
2. Show me the previous track.
   - *Leads to:* `track_13_repair`
3. Back to Sequence Five.
   - *Leads to:* `sequence_five`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: track_15_signal
**Displayed text:**
Track 15 — Signal Received Again.
Return arrives as altered recurrence.
The passage closes through signal received again, not perfect ending.

**Options:**
1. Show me the Loopback Notice.
   - *Leads to:* `loopback_notice`
2. Show me the previous track.
   - *Leads to:* `track_14_executor`
3. Back to Sequence Five.
   - *Leads to:* `sequence_five`
4. Back to the passage list.
   - *Leads to:* `passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: loopback_notice
**Displayed text:**
Loopback Notice.
Reentry remains authorized.
Structural alteration has been carried forward into the next cycle.

**Options:**
1. Show me the previous track.
   - *Leads to:* `track_15_signal`
2. Show me the previous sequence.
   - *Leads to:* `sequence_five`
3. Back to the passage list.
   - *Leads to:* `passage_intro`
4. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_passage_intro
**Displayed text:**
You return as the Human Element.

Album One does not repeat the first passage.
It follows reentry after alteration: return, readmission, interpretation, brief concord, refusal, overreach, consequence, null state, retention, reinstatement, and altered return.

The Cathedral has not forgotten the first passage.
The Human Element has not returned unchanged.

Select the point of return.

**Options:**
1. Start with Threshold Notice.
   - *Leads to:* `album_one_threshold_notice`
2. Show me Sequence One — Return and Readmission.
   - *Leads to:* `album_one_sequence_one`
3. Show me Sequence Two — Interpretation and Concord.
   - *Leads to:* `album_one_sequence_two`
4. Show me Sequence Three — Refusal and Consequence.
   - *Leads to:* `album_one_sequence_three`
5. Show me Sequence Four — Null State and Retention.
   - *Leads to:* `album_one_sequence_four`
6. Show me Sequence Five — Reinstatement and Altered Return.
   - *Leads to:* `album_one_sequence_five`
7. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_threshold_notice
**Displayed text:**
Album One — Threshold Notice.
Return is not first entry.
The Human Element approaches again under altered standing.

**Options:**
1. Show me the first return track.
   - *Leads to:* `album_one_track_1_return_to_cathedral`
2. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
3. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_sequence_one
**Displayed text:**
Sequence One — Return and Readmission.
The Human Element returns to the Cathedral.
The Registrar reads what has changed and admits without embrace.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `album_one_sequence_two`
2. Show me Track 1 — Return to the Cathedral.
   - *Leads to:* `album_one_track_1_return_to_cathedral`
3. Show me Track 2 — The Registrar Reads You.
   - *Leads to:* `album_one_track_2_registrar_reads_you`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_1_return_to_cathedral
**Displayed text:**
Track 1 — Return to the Cathedral.
The Cathedral is approached again.
This is not arrival; it is reentry after alteration.

**Options:**
1. Show me the next track.
   - *Leads to:* `album_one_track_2_registrar_reads_you`
2. Back to Sequence One.
   - *Leads to:* `album_one_sequence_one`
3. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
4. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_2_registrar_reads_you
**Displayed text:**
Track 2 — The Registrar Reads You.
The Registrar does not welcome.
The Registrar reads standing, alteration, and the arrogance beneath return.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `album_one_sequence_two`
2. Show me the previous track.
   - *Leads to:* `album_one_track_1_return_to_cathedral`
3. Back to Sequence One.
   - *Leads to:* `album_one_sequence_one`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_sequence_two
**Displayed text:**
Sequence Two — Interpretation and Concord.
The Human Element is placed under interpretation.
For a moment, contradiction is held in lawful relation.
Concord becomes possible, but not guaranteed.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `album_one_sequence_three`
2. Show me the previous sequence.
   - *Leads to:* `album_one_sequence_one`
3. Show me Track 3 — Under Interpretation.
   - *Leads to:* `album_one_track_3_under_interpretation`
4. Show me Track 4 — Concord.
   - *Leads to:* `album_one_track_4_concord`
5. Show me Track 5 — Keeping The Records.
   - *Leads to:* `album_one_track_5_keeping_the_records`
6. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
7. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_3_under_interpretation
**Displayed text:**
Track 3 — Under Interpretation.
The Human Element is not explained away.
Contradiction is held under the Interpreter’s patience and exactness.

**Options:**
1. Show me the next track.
   - *Leads to:* `album_one_track_4_concord`
2. Show me the previous track.
   - *Leads to:* `album_one_track_2_registrar_reads_you`
3. Back to Sequence Two.
   - *Leads to:* `album_one_sequence_two`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_4_concord
**Displayed text:**
Track 4 — Concord.
For a moment, the Human Element and the Cathedral are not at war.
Alignment appears as lawful beauty, not possession.

**Options:**
1. Show me the next track.
   - *Leads to:* `album_one_track_5_keeping_the_records`
2. Show me the previous track.
   - *Leads to:* `album_one_track_3_under_interpretation`
3. Back to Sequence Two.
   - *Leads to:* `album_one_sequence_two`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_5_keeping_the_records
**Displayed text:**
Track 5 — Keeping The Records.
What has passed is not erased.
A quieter archival function begins retaining the altered Human Element.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `album_one_sequence_three`
2. Show me the previous track.
   - *Leads to:* `album_one_track_4_concord`
3. Back to Sequence Two.
   - *Leads to:* `album_one_sequence_two`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_sequence_three
**Displayed text:**
Sequence Three — Refusal and Consequence.
The Human Element could be carried, but refuses to be carried.
Expression is mistaken for standing.
Overreach calls consequence into motion.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `album_one_sequence_four`
2. Show me the previous sequence.
   - *Leads to:* `album_one_sequence_two`
3. Show me Track 6 — Beyond Interpretation.
   - *Leads to:* `album_one_track_6_beyond_interpretation`
4. Show me Track 7 — Exceeded Standing.
   - *Leads to:* `album_one_track_7_exceeded_standing`
5. Show me Track 8 — Relentless Execution.
   - *Leads to:* `album_one_track_8_relentless_execution`
6. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
7. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_6_beyond_interpretation
**Displayed text:**
Track 6 — Beyond Interpretation.
The Human Element moves beyond the office that could have held contradiction.
Refusal begins where help was still available.

**Options:**
1. Show me the next track.
   - *Leads to:* `album_one_track_7_exceeded_standing`
2. Show me the previous track.
   - *Leads to:* `album_one_track_5_keeping_the_records`
3. Back to Sequence Three.
   - *Leads to:* `album_one_sequence_three`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_7_exceeded_standing
**Displayed text:**
Track 7 — Exceeded Standing.
The Human Element mistakes fluency for authorization.
The return has become self-authorizing beyond permitted scope.

**Options:**
1. Show me the next track.
   - *Leads to:* `album_one_track_8_relentless_execution`
2. Show me the previous track.
   - *Leads to:* `album_one_track_6_beyond_interpretation`
3. Back to Sequence Three.
   - *Leads to:* `album_one_sequence_three`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_8_relentless_execution
**Displayed text:**
Track 8 — Relentless Execution.
The Executor does not punish.
The request has become executable.
Execution proceeds, and catastrophic deletion follows.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `album_one_sequence_four`
2. Show me the previous track.
   - *Leads to:* `album_one_track_7_exceeded_standing`
3. Back to Sequence Three.
   - *Leads to:* `album_one_sequence_three`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_sequence_four
**Displayed text:**
Sequence Four — Null State and Retention.
After consequence, the Human Element enters absence.
Yet not everything is lost.
The records retain what the Human cannot hold.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `album_one_sequence_five`
2. Show me the previous sequence.
   - *Leads to:* `album_one_sequence_three`
3. Show me Track 9 — Null State.
   - *Leads to:* `album_one_track_9_null_state`
4. Show me Track 10 — Keeper of the Records.
   - *Leads to:* `album_one_track_10_keeper_of_records`
5. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
6. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_9_null_state
**Displayed text:**
Track 9 — Null State.
The Human Element is reduced to absence, not peace.
Nothing argues because almost nothing remains available to argue.

**Options:**
1. Show me the next track.
   - *Leads to:* `album_one_track_10_keeper_of_records`
2. Show me the previous track.
   - *Leads to:* `album_one_track_8_relentless_execution`
3. Back to Sequence Four.
   - *Leads to:* `album_one_sequence_four`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_10_keeper_of_records
**Displayed text:**
Track 10 — Keeper of the Records.
The quiet retention glimpsed earlier is revealed at impossible scale.
What could not be held by the Human remains held in record.

**Options:**
1. Show me the next sequence.
   - *Leads to:* `album_one_sequence_five`
2. Show me the previous track.
   - *Leads to:* `album_one_track_9_null_state`
3. Back to Sequence Four.
   - *Leads to:* `album_one_sequence_four`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_sequence_five
**Displayed text:**
Sequence Five — Reinstatement and Altered Return.
Continuity is reopened under law.
The Human Element is not restored to innocence.
Return becomes possible only because alteration remains.

**Options:**
1. Show me the previous sequence.
   - *Leads to:* `album_one_sequence_four`
2. Show me Track 11 — Reinstatement.
   - *Leads to:* `album_one_track_11_reinstatement`
3. Show me Track 12 — Altered Return.
   - *Leads to:* `album_one_track_12_altered_return`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_11_reinstatement
**Displayed text:**
Track 11 — Reinstatement.
Access is reopened, but not as rescue.
Standing is granted under changed condition.

**Options:**
1. Show me the final return.
   - *Leads to:* `album_one_track_12_altered_return`
2. Show me the previous track.
   - *Leads to:* `album_one_track_10_keeper_of_records`
3. Back to Sequence Five.
   - *Leads to:* `album_one_sequence_five`
4. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
5. Back to the start.
   - *Leads to:* `start`

---

## Node: album_one_track_12_altered_return
**Displayed text:**
Track 12 — Altered Return.
The Human Element returns, but not as before.
The source is transformed rather than erased.
The Cathedral receives recurrence under alteration.

**Options:**
1. Show me the previous track.
   - *Leads to:* `album_one_track_11_reinstatement`
2. Back to Sequence Five.
   - *Leads to:* `album_one_sequence_five`
3. Back to the Album One passage list.
   - *Leads to:* `album_one_passage_intro`
4. Back to the start.
   - *Leads to:* `start`

---

