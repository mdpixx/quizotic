// Reserved slot between the product showcase and the FAQ. Intentionally
// renders nothing: we don't fabricate testimonials or usage numbers. When
// real proof exists, it slots in here without touching the page layout:
//   - testimonials: real quotes with name + institution (with permission)
//   - usage counters: live aggregates from our own DB (quizzes created,
//     questions answered), cached and above an honesty threshold
export function SocialProofSlot() {
  return null
}
