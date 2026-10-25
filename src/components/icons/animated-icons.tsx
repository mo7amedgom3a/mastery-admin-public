/* oxlint-disable react/only-export-components */
/**
 * The ten lucide-animated icons this site uses, vendored (lucide-animated 1.0.5, MIT).
 *
 * The package ships one un-annotated file with every icon (`forwardRef(...)` at module top level),
 * so bundlers cannot tree-shake it and the whole ~730 KB library landed in the landing page's
 * client JS. Same markup, variants and imperative handle as upstream.
 */
import { motion, useAnimation, type Variants } from "motion/react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type RefAttributes,
} from "react";

export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

export type AnimatedIconProps = HTMLAttributes<HTMLDivElement> & {
  size?: number;
  animateOnHover?: boolean;
};

type Controls = ReturnType<typeof useAnimation>;
type AnimatedIcon = ForwardRefExoticComponent<AnimatedIconProps & RefAttributes<AnimatedIconHandle>>;

const svgProps = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: "2",
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
} as const;

/**
 * Upstream's shared shell: animates on hover unless a parent took control through the ref, in
 * which case hover events are passed through to the parent's handlers instead.
 */
function createAnimatedIcon(name: string, render: (controls: Controls, size: number) => ReactNode): AnimatedIcon {
  const Icon = forwardRef<AnimatedIconHandle, AnimatedIconProps>(function AnimatedIcon(
    { onMouseEnter, onMouseLeave, size = 28, animateOnHover = true, ...props },
    ref,
  ) {
    const controls = useAnimation();
    const isControlledRef = useRef(false);

    useImperativeHandle(ref, () => {
      isControlledRef.current = true;
      return {
        startAnimation: () => void controls.start("animate"),
        stopAnimation: () => void controls.start("normal"),
      };
    });

    const handleMouseEnter = useCallback(
      (event: MouseEvent<HTMLDivElement>) => {
        if (!isControlledRef.current && animateOnHover) void controls.start("animate");
        else onMouseEnter?.(event);
      },
      [controls, onMouseEnter, animateOnHover],
    );

    const handleMouseLeave = useCallback(
      (event: MouseEvent<HTMLDivElement>) => {
        if (isControlledRef.current) onMouseLeave?.(event);
        else void controls.start("normal");
      },
      [controls, onMouseLeave],
    );

    return (
      <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} {...props}>
        {render(controls, size)}
      </div>
    );
  });
  Icon.displayName = name;
  return Icon;
}

const ARROW_HEAD_VARIANTS: Variants = {
  normal: { d: "m12 19-7-7 7-7", translateX: 0 },
  animate: { d: "m12 19-7-7 7-7", translateX: [0, 3, 0], transition: { duration: 0.4 } },
};
const ARROW_SHAFT_VARIANTS: Variants = {
  normal: { d: "M19 12H5" },
  animate: { d: ["M19 12H5", "M19 12H10", "M19 12H5"], transition: { duration: 0.4 } },
};

export const ArrowLeftIcon = createAnimatedIcon("ArrowLeftIcon", (controls, size) => (
  <svg {...svgProps} width={size} height={size}>
    <motion.path animate={controls} d="m12 19-7-7 7-7" variants={ARROW_HEAD_VARIANTS} />
    <motion.path animate={controls} d="M19 12H5" variants={ARROW_SHAFT_VARIANTS} />
  </svg>
));

const CART_VARIANTS: Variants = {
  normal: { scale: 1 },
  animate: {
    scale: 1.1,
    y: [0, -5, 0],
    transition: { duration: 0.3, ease: "easeInOut", y: { repeat: 1, delay: 0.1, duration: 0.4 } },
  },
};

export const CartIcon = createAnimatedIcon("CartIcon", (controls, size) => (
  <motion.svg
    {...svgProps}
    width={size}
    height={size}
    animate={controls}
    transition={{ duration: 0.2 }}
    variants={CART_VARIANTS}
  >
    <path d="M6.29977 5H21L19 12H7.37671M20 16H8L6 3H3M9 20C9 20.5523 8.55228 21 8 21C7.44772 21 7 20.5523 7 20C7 19.4477 7.44772 19 8 19C8.55228 19 9 19.4477 9 20ZM20 20C20 20.5523 19.5523 21 19 21C18.4477 21 18 20.5523 18 20C18 19.4477 18.4477 19 19 19C19.5523 19 20 19.4477 20 20Z" />
  </motion.svg>
));

const CHECK_VARIANTS: Variants = {
  normal: { opacity: 1, pathLength: 1, scale: 1, transition: { duration: 0.3, opacity: { duration: 0.1 } } },
  animate: {
    opacity: [0, 1],
    pathLength: [0, 1],
    scale: [0.5, 1],
    transition: { duration: 0.4, opacity: { duration: 0.1 } },
  },
};

export const CheckIcon = createAnimatedIcon("CheckIcon", (controls, size) => (
  <svg {...svgProps} width={size} height={size}>
    <motion.path animate={controls} d="M4 12 9 17L20 6" initial="normal" variants={CHECK_VARIANTS} />
  </svg>
));

const HEART_VARIANTS: Variants = { normal: { scale: 1 }, animate: { scale: [1, 1.08, 1] } };

export const HeartIcon = createAnimatedIcon("HeartIcon", (controls, size) => (
  <motion.svg
    {...svgProps}
    width={size}
    height={size}
    animate={controls}
    transition={{ duration: 0.45, repeat: 2 }}
    variants={HEART_VARIANTS}
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </motion.svg>
));

const MENU_LINE_VARIANTS: Variants = {
  normal: { rotate: 0, y: 0, opacity: 1 },
  animate: (line: number) => ({
    rotate: line === 1 ? 45 : line === 3 ? -45 : 0,
    y: line === 1 ? 6 : line === 3 ? -6 : 0,
    opacity: line === 2 ? 0 : 1,
    transition: { type: "spring", stiffness: 260, damping: 20 },
  }),
};

export const MenuIcon = createAnimatedIcon("MenuIcon", (controls, size) => (
  <svg {...svgProps} width={size} height={size}>
    {[6, 12, 18].map((y, index) => (
      <motion.line
        key={y}
        animate={controls}
        custom={index + 1}
        variants={MENU_LINE_VARIANTS}
        x1="4"
        x2="20"
        y1={String(y)}
        y2={String(y)}
      />
    ))}
  </svg>
));

const MOON_VARIANTS: Variants = { normal: { rotate: 0 }, animate: { rotate: [0, -10, 10, -5, 5, 0] } };

export const MoonIcon = createAnimatedIcon("MoonIcon", (controls, size) => (
  <motion.svg
    {...svgProps}
    width={size}
    height={size}
    animate={controls}
    transition={{ duration: 1.2, ease: "easeInOut" }}
    variants={MOON_VARIANTS}
  >
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </motion.svg>
));

const PAUSE_TRANSITION = { times: [0, 0.2, 0.5, 1], duration: 0.5, stiffness: 260, damping: 20 };
const PAUSE_LEFT_VARIANTS: Variants = { normal: { y: 0 }, animate: { y: [0, 2, 0, 0], transition: PAUSE_TRANSITION } };
const PAUSE_RIGHT_VARIANTS: Variants = { normal: { y: 0 }, animate: { y: [0, 0, 2, 0], transition: PAUSE_TRANSITION } };

export const PauseIcon = createAnimatedIcon("PauseIcon", (controls, size) => (
  <svg {...svgProps} width={size} height={size}>
    <motion.rect animate={controls} height="16" rx="1" variants={PAUSE_LEFT_VARIANTS} width="4" x="6" y="4" />
    <motion.rect animate={controls} height="16" rx="1" variants={PAUSE_RIGHT_VARIANTS} width="4" x="14" y="4" />
  </svg>
));

const PLAY_VARIANTS: Variants = {
  normal: { x: 0, rotate: 0 },
  animate: {
    x: [0, -1, 2, 0],
    rotate: [0, -10, 0, 0],
    transition: { duration: 0.5, times: [0, 0.2, 0.5, 1], stiffness: 260, damping: 20 },
  },
};

export const PlayIcon = createAnimatedIcon("PlayIcon", (controls, size) => (
  <svg {...svgProps} width={size} height={size}>
    <motion.polygon animate={controls} points="6 3 20 12 6 21 6 3" variants={PLAY_VARIANTS} />
  </svg>
));

const SUN_RAYS = [
  "M12 2v2",
  "m19.07 4.93-1.41 1.41",
  "M20 12h2",
  "m17.66 17.66 1.41 1.41",
  "M12 20v2",
  "m6.34 17.66-1.41 1.41",
  "M2 12h2",
  "m4.93 4.93 1.41 1.41",
];
const SUN_RAY_VARIANTS: Variants = {
  normal: { opacity: 1 },
  animate: (ray: number) => ({ opacity: [0, 1], transition: { delay: ray * 0.1, duration: 0.3 } }),
};

export const SunIcon = createAnimatedIcon("SunIcon", (controls, size) => (
  <svg {...svgProps} width={size} height={size}>
    <circle cx="12" cy="12" r="4" />
    {SUN_RAYS.map((d, index) => (
      <motion.path key={d} animate={controls} custom={index + 1} d={d} variants={SUN_RAY_VARIANTS} />
    ))}
  </svg>
));

const X_VARIANTS: Variants = { normal: { opacity: 1, pathLength: 1 }, animate: { opacity: [0, 1], pathLength: [0, 1] } };

export const XIcon = createAnimatedIcon("XIcon", (controls, size) => (
  <svg {...svgProps} width={size} height={size}>
    <motion.path animate={controls} d="M18 6 6 18" variants={X_VARIANTS} />
    <motion.path animate={controls} d="m6 6 12 12" transition={{ delay: 0.2 }} variants={X_VARIANTS} />
  </svg>
));

const SEARCH_LENS_VARIANTS: Variants = {
  normal: { scale: 1, x: 0, y: 0 },
  animate: { scale: [1, 1.12, 1], x: [0, -1.5, 0], y: [0, -1.5, 0], transition: { duration: 0.5, ease: "easeInOut" } },
};

const SEARCH_HANDLE_VARIANTS: Variants = {
  normal: { pathLength: 1, opacity: 1 },
  animate: { pathLength: [0, 1], opacity: [0, 1], transition: { duration: 0.35, delay: 0.1, ease: "easeOut" } },
};

export const SearchIcon = createAnimatedIcon("SearchIcon", (controls, size) => (
  <svg {...svgProps} width={size} height={size}>
    <motion.circle animate={controls} cx="11" cy="11" r="7" variants={SEARCH_LENS_VARIANTS} style={{ transformOrigin: "11px 11px" }} />
    <motion.path animate={controls} d="m21 21-4.3-4.3" variants={SEARCH_HANDLE_VARIANTS} />
  </svg>
));
