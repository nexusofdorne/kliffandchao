import { finalNote } from '@/content/final-note';

// The couple's last word to their guests, set like a short letter.
export function FinalNoteTab() {
  return (
    <article className="mx-auto max-w-[620px] text-left text-[clamp(10.5px,1.38vh,14px)] leading-[1.85] text-[#2c3124]">
      <h2 className="mb-[2.6vh] text-center text-[clamp(13px,2vh,21px)] font-medium tracking-[-.01em] text-[#14180d]">
        {finalNote.title}
      </h2>
      {finalNote.paragraphs.map((paragraph) => (
        <p key={paragraph} className="m-0 mb-[1.5vh]">
          {paragraph}
        </p>
      ))}
      <p className="m-0 mb-[1.5vh] font-semibold text-[#14180d]">
        {finalNote.thanks}
      </p>
      <p className="m-0 mb-[2.4vh]">{finalNote.closing}</p>
      <p className="m-0">{finalNote.signOff}</p>
      <p className="m-0 font-semibold text-[#14180d]">{finalNote.signature}</p>
    </article>
  );
}
