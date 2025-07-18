import {
  IPropertyIdentValueDescriptor,
  PropertyDescriptorParsingType,
} from "../IPropertyDescriptor";
import { Context } from "../../core/context";
export const enum OVERFLOW_WRAP {
  NORMAL = "normal",
  BREAK_WORD = "break-word",
}

export const overflowWrap: IPropertyIdentValueDescriptor<OVERFLOW_WRAP> = {
  name: "overflow-wrap",
  initialValue: "normal",
  prefix: false,
  type: PropertyDescriptorParsingType.IDENT_VALUE,
  parse: (_context: Context, overflow: string) => {
    switch (overflow) {
      case "break-word":
        return OVERFLOW_WRAP.BREAK_WORD;
      case "normal":
      default:
        return OVERFLOW_WRAP.NORMAL;
    }
  },
};
