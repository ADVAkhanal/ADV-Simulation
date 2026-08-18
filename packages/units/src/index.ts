/**
 * Shared unit types. Every cross-package number that has a physical dimension
 * should be typed through here, not passed as a bare `number` - a MachineProfile's
 * `maxSpindleRpm` and a ToolState's `stickoutMm` must never be silently
 * interchangeable with each other or with a unitless score.
 *
 * Per PRODUCT_SPEC.md §27: "metric -> imperial -> metric conversion must preserve
 * value within numerical tolerance" is a required test once conversion exists.
 * No conversion functions are implemented yet - this package only establishes the
 * types conversions will operate on, per the "smallest coherent architecture"
 * instruction in §44.
 */

export type Millimeters = number & { readonly __unit: "mm" };
export type Inches = number & { readonly __unit: "in" };
export type Rpm = number & { readonly __unit: "rpm" };
export type Hertz = number & { readonly __unit: "hz" };
export type MillimetersPerMinute = number & { readonly __unit: "mm/min" };
export type MillimetersPerRevolution = number & { readonly __unit: "mm/rev" };
export type Newtons = number & { readonly __unit: "N" };
export type Celsius = number & { readonly __unit: "degC" };
export type Seconds = number & { readonly __unit: "s" };
export type Kilograms = number & { readonly __unit: "kg" };
export type NewtonMetersPerRadian = number & { readonly __unit: "Nm/rad" };

export const mm = (value: number): Millimeters => value as Millimeters;
export const inches = (value: number): Inches => value as Inches;
export const rpm = (value: number): Rpm => value as Rpm;
export const hz = (value: number): Hertz => value as Hertz;
export const seconds = (value: number): Seconds => value as Seconds;
export const celsius = (value: number): Celsius => value as Celsius;

/** rotation_frequency = RPM / 60, per PRODUCT_SPEC.md §9. */
export function rotationFrequency(spindleRpm: Rpm): Hertz {
  return hz((spindleRpm as number) / 60);
}

/** tooth_pass_frequency = rotation_frequency * flute_count, per PRODUCT_SPEC.md §9. */
export function toothPassFrequency(spindleRpm: Rpm, fluteCount: number): Hertz {
  return hz((rotationFrequency(spindleRpm) as number) * fluteCount);
}
