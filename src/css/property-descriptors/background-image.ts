import { TokenType } from "../syntax/tokenizer";
import { ICSSImage, image, isSupportedImage } from "../types/image";
import {
  IPropertyListDescriptor,
  PropertyDescriptorParsingType,
} from "../IPropertyDescriptor";
import { CSSValue, nonFunctionArgSeparator } from "../syntax/parser";
import { Context } from "../../core/context";

export const backgroundImage: IPropertyListDescriptor<ICSSImage[]> = {
  name: "background-image",
  initialValue: "none",
  type: PropertyDescriptorParsingType.LIST,
  prefix: false,
  parse: (context: Context, tokens: CSSValue[]) => {
    if (tokens.length === 0) {
      return [];
    }

    const first = tokens[0];

    if (first.type === TokenType.IDENT_TOKEN && first.value === "none") {
      return [];
    }

    return tokens
      .filter(
        (value) => nonFunctionArgSeparator(value) && isSupportedImage(value)
      )
      .map((value) => image.parse(context, value));
  },
};
