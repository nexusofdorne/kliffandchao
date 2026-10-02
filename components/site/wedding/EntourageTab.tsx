import { entourageGroups } from '@/content/entourage';

// Plain text, no surfaces — the entourage is a list of names, and boxing
// each group made it read as a set of cards competing for attention.
// No content was designed for this tab (docs/PLAN.md); this is structure
// only, role-grouped, waiting on the couple's real list.
export function EntourageTab() {
  return (
    <div>
      <div className="mb-[1.2vh] text-[clamp(12px,1.9vh,20px)] font-medium tracking-[-.01em]">ENTOURAGE</div>
      <div className="mt-[5vh] grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-x-[3vw] gap-y-[5vh] text-center">
        {entourageGroups.map((group) => (
          <div key={group.role}>
            <h4 className="mb-[1.6vh] text-[9.5px] font-semibold tracking-[.14em] text-[var(--green)]">
              {group.role}
            </h4>
            <p className="text-[clamp(10px,1.3vh,13px)] leading-[2] text-[#3a4030]">
              {group.names.map((name, index) => (
                <span key={index}>
                  {name}
                  {index < group.names.length - 1 && <br />}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-[3vh] text-[11px] leading-[2] tracking-[.14em] text-[rgba(0,0,0,.5)]">
        No content was designed for this tab — structure only.
      </p>
    </div>
  );
}
