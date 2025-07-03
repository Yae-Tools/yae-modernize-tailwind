
import createAxisConversion from "./util/axisConversion.js";
import colorOpacityConversion from "./util/colorOpacityConversion.js";
import gapConversion from "./util/gapConversion.js";
import sizeConversion from "./util/sizeConversion.js";

export const CONVERSIONS = {
  size: sizeConversion,
  margin: createAxisConversion("m"),
  padding: createAxisConversion("p"),
  "color-opacity": colorOpacityConversion,
  gap: gapConversion,
};
