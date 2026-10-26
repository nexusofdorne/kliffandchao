import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

// CSS cubic-beziers from the prototype, as GSAP eases.
export const easings = {
  /** accelerating dive through the screen */
  dive: CustomEase.create('dive', '.5,0,.8,.3'),
  /** settling back out */
  surfaceOut: CustomEase.create('surfaceOut', '.2,.75,.2,1'),
  /** the window growing out of its folder */
  grow: CustomEase.create('grow', '.25,.8,.25,1'),
  shrink: CustomEase.create('shrink', '.5,0,.75,0'),
  cursor: CustomEase.create('cursor', '.45,0,.2,1'),
  /** a camera coming out of a motion blur */
  arrive: CustomEase.create('arrive', '.2,.7,.2,1'),
} as const;
