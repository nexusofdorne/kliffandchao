// The FAQ tab's questions and answers: the couple's final copy (3.0/instructions.txt).
// Each answer is a list of paragraphs (a `\n` inside one is a line break). A paragraph
// may mention CHAODESIGN_HANDLE; the tab links it to siteConfig.chaodesignUrl.
export type FaqEntry = {
  question: string;
  answer: readonly string[];
};

/** Chao's studio handle; wherever an answer mentions it, it becomes a link. */
export const CHAODESIGN_HANDLE = '@chaodesign';

export const faqEntries: readonly FaqEntry[] = [
  {
    question: 'How early should we arrive?',
    answer: [
      "Our ceremony begins at 4:00 PM sharp, and we'd love for you to be there from the beginning!",
      'As traffic can get quite heavy around this time, we recommend leaving Cebu City by 2:30 PM and Mactan by 3:00 PM. This should give you some time to park, find your seats, and settle in before the ceremony.',
    ],
  },
  {
    question: 'Until when can I RSVP?',
    answer: [
      'Please confirm your attendance by February 5 through our wedding website.',
      'This helps us finalize our guest list, seating arrangements, and all the little details before the big day.',
    ],
  },
  {
    question: 'Can I bring a plus-one?',
    answer: [
      "As much as we'd love to have everyone celebrate with us, we've carefully planned our guest list and seating arrangements. For this reason, we can only accommodate guests whose names are listed on the RSVP.",
      "If there's someone you'd really need to bring, please reach out to us in advance. We can't guarantee an additional seat, but we'll see what we can arrange.",
      'Thank you for understanding!',
    ],
  },
  {
    question: 'Are children welcome?',
    answer: [
      'Of course! We love your little ones.',
      "Children included in your invitation are more than welcome. If you'd like to bring a child who isn't listed, please message us first so we can check our seating arrangements.",
    ],
  },
  {
    question: 'Will this be a garden wedding?',
    answer: [
      "A little bit of garden, a little bit of ocean, but we'll be celebrating INDOORS!",
      'Our ceremony will be held inside a pavilion, followed by the reception in a ballroom. So yes, you can wear your favorite heels, and no need to bring your Jisulife fans!',
    ],
  },
  {
    question: 'Is there parking available?',
    answer: [
      'Yes! Jpark Island Resort has a spacious parking area available for our guests.',
    ],
  },
  {
    question: 'Will transportation be provided?',
    answer: [
      "We'll have a coaster available after the reception for guests heading back to Cebu City, with a drop-off at IT Park.",
      'For those traveling elsewhere or leaving at a different time, Grab is another option and operates 24/7.',
      'Please arrange your own transportation to the ceremony.',
    ],
  },
  {
    question: 'Can I take photos and videos?',
    answer: [
      "Absolutely! We'd love to see the day through your eyes, too.",
      'Feel free to capture moments throughout the ceremony and reception. We just kindly ask that you remain in your seats during the ceremony and keep the aisle clear so our photographers and videographers can do their thing.',
      "And don't forget to tag us on Instagram and Facebook. We'd love to see your shots!",
    ],
  },
  {
    question: 'Is there a dress code or color motif?',
    answer: [
      "Yes! We've put together a little color guide to help you dress for the occasion. You can find it in the Wedding Motif section.",
      "We'd also love to keep white reserved for the bride and the groom, so we kindly ask our guests to choose other colors for the celebration.",
    ],
  },
  {
    question: 'Will the ceremony and reception be at the same venue?',
    answer: [
      "Yes! Both will be held at Jpark Island Resort, so there's no need to travel to another location after the ceremony.",
    ],
  },
  {
    question: 'Who should I contact on the wedding day?',
    answer: [
      "We'll probably be a little busy on the day! If you need assistance with directions, parking, or anything on the day itself, please reach out to our wedding coordinator.",
      'The Centerpiece:\n@Leizl\n@Roderick\n(Number TBD)',
    ],
  },
  {
    question: 'P.S. Curious who made this website?',
    answer: [
      'We did! A little project by the bride and groom, made with lots of love (and a handful of debugging sessions).',
      `While you're here, say hi to ${CHAODESIGN_HANDLE} if you've got something creative coming up haha!`,
    ],
  },
];
