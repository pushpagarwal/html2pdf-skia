import { strictEqual } from "assert";
import { color } from "../color";
import { asString, isTransparent, pack } from "../color-utilities";
import { Parser } from "../../syntax/parser";
import { Context } from "../../../core/context";

const parse = (value: string) =>
  color.parse({} as Context, Parser.parseValue(value));

describe("types", () => {
  describe("<color>", () => {
    describe("parsing", () => {
      it("#000", () => strictEqual(parse("#000"), pack(0, 0, 0, 1)));
      it("#0000", () => strictEqual(parse("#0000"), pack(0, 0, 0, 0)));
      it("#000f", () => strictEqual(parse("#000f"), pack(0, 0, 0, 1)));
      it("#fff", () => strictEqual(parse("#fff"), pack(255, 255, 255, 1)));
      it("#000000", () => strictEqual(parse("#000000"), pack(0, 0, 0, 1)));
      it("#00000000", () => strictEqual(parse("#00000000"), pack(0, 0, 0, 0)));
      it("#ffffff", () =>
        strictEqual(parse("#ffffff"), pack(255, 255, 255, 1)));
      it("#ffffffff", () =>
        strictEqual(parse("#ffffffff"), pack(255, 255, 255, 1)));
      it("#7FFFD4", () =>
        strictEqual(parse("#7FFFD4"), pack(127, 255, 212, 1)));
      it("#f0ffff", () =>
        strictEqual(parse("#f0ffff"), pack(240, 255, 255, 1)));
      it("transparent", () =>
        strictEqual(parse("transparent"), pack(0, 0, 0, 0)));
      it("bisque", () => strictEqual(parse("bisque"), pack(255, 228, 196, 1)));
      it("BLUE", () => strictEqual(parse("BLUE"), pack(0, 0, 255, 1)));
      it("rgb(1, 3, 5)", () =>
        strictEqual(parse("rgb(1, 3, 5)"), pack(1, 3, 5, 1)));
      it("rgb(0% 0% 0%)", () =>
        strictEqual(parse("rgb(0% 0% 0%)"), pack(0, 0, 0, 1)));
      it("rgb(50% 50% 50%)", () =>
        strictEqual(parse("rgb(50% 50% 50%)"), pack(128, 128, 128, 1)));
      it("rgba(50% 50% 50% 50%)", () =>
        strictEqual(parse("rgba(50% 50% 50% 50%)"), pack(128, 128, 128, 0.5)));
      it("rgb(100% 100% 100%)", () =>
        strictEqual(parse("rgb(100% 100% 100%)"), pack(255, 255, 255, 1)));
      it("rgb(222 111 50)", () =>
        strictEqual(parse("rgb(222 111 50)"), pack(222, 111, 50, 1)));
      it("rgba(200, 3, 5, 1)", () =>
        strictEqual(parse("rgba(200, 3, 5, 1)"), pack(200, 3, 5, 1)));
      it("rgba(222, 111, 50, 0.22)", () =>
        strictEqual(
          parse("rgba(222, 111, 50, 0.22)"),
          pack(222, 111, 50, 0.22)
        ));
      it("rgba(222 111 50 0.123)", () =>
        strictEqual(
          parse("rgba(222 111 50 0.123)"),
          pack(222, 111, 50, 0.123)
        ));
      it("hsl(270,60%,70%)", () =>
        strictEqual(parse("hsl(270,60%,70%)"), parse("rgb(178,132,224)")));
      it("hsl(270, 60%, 70%)", () =>
        strictEqual(parse("hsl(270, 60%, 70%)"), parse("rgb(178,132,224)")));
      it("hsl(270 60% 70%)", () =>
        strictEqual(parse("hsl(270 60% 70%)"), parse("rgb(178,132,224)")));
      it("hsl(270deg, 60%, 70%)", () =>
        strictEqual(parse("hsl(270deg, 60%, 70%)"), parse("rgb(178,132,224)")));
      it("hsl(4.71239rad, 60%, 70%)", () =>
        strictEqual(
          parse("hsl(4.71239rad, 60%, 70%)"),
          parse("rgb(178,132,224)")
        ));
      it("hsl(.75turn, 60%, 70%)", () =>
        strictEqual(
          parse("hsl(.75turn, 60%, 70%)"),
          parse("rgb(178,132,224)")
        ));
      it("hsla(.75turn, 60%, 70%, 50%)", () =>
        strictEqual(
          parse("hsl(.75turn, 60%, 70%, 50%)"),
          parse("rgba(178,132,224, 0.5)")
        ));
      it("oklch(0.93 0.39 28deg)", () =>
        strictEqual(parse("oklch(0.93 0.39 28deg)"), pack(255, 0, 23, 1)));
      it("oklch(0.93 0.39 28)", () =>
        strictEqual(parse("oklch(0.93 0.39 28)"), pack(255, 0, 23, 1)));
      it("oklch(0.63 0.26 27.65)", () =>
        strictEqual(parse("oklch(0.63 0.26 27.65)"), pack(255, 0, 20, 1)));
      it("oklch(0.57 0.23 145.62)", () =>
        strictEqual(parse("oklch(0.57 0.23 145.62)"), pack(0, 151, 0, 1)));
      it("oklch(0.57 0.23 145.62 / 0.5)", () =>
        strictEqual(
          parse("oklch(0.57 0.23 145.62 / 0.5)"),
          pack(0, 151, 0, 0.5)
        ));
      it("oklab(0.4 0.11 0.05)", () =>
        strictEqual(parse("oklab(0.4 0.11 0.05)"), pack(124, 37, 37, 1)));
      it("oklab(0.57 -0.19 0.13)", () =>
        strictEqual(parse("oklab(0.57 -0.19 0.13)"), pack(0, 151, 0, 1)));
      it("oklab(0.57 -0.19 0.13 / 50%)", () =>
        strictEqual(
          parse("oklab(0.57 -0.19 0.13 / 50%)"),
          pack(0, 151, 0, 0.5)
        ));
      it("lab(53 -66.2 60.96)", () =>
        strictEqual(parse("lab(53 -66.2 60.96)"), pack(0, 151, 0, 1)));
      it("lab(63 -41.52 -25.36)", () =>
        strictEqual(parse("lab(63 -41.52 -25.36)"), pack(0, 173, 196, 1)));
      it("lab(63 -41.52 -25.36 / 0.5)", () =>
        strictEqual(
          parse("lab(63 -41.52 -25.36 / 0.5)"),
          pack(0, 173, 196, 0.5)
        ));
      it("lch(29.2345% 44.2 27)", () =>
        strictEqual(parse("lch(29.2345% 44.2 27)"), pack(125, 35, 41, 1)));
      it("lch(52.2345% 72.2 56.2)", () =>
        strictEqual(parse("lch(52.2345% 72.2 56.2)"), pack(198, 93, 6, 1)));
      it("color(srgb 1 0 0)", () =>
        strictEqual(parse("color(srgb 1 0 0)"), pack(255, 0, 0, 1)));
      it("color(srgb 1 0 0 / .5)", () =>
        strictEqual(parse("color(srgb 1 0 0 / .5)"), pack(255, 0, 0, 0.5)));
      it("color(srgb 0.5 0 0.5)", () =>
        strictEqual(parse("color(srgb 0.5 0 0.5)"), pack(128, 0, 128, 1)));
      it("color(xyz 0.11 0.17 0.24)", () =>
        strictEqual(parse("color(xyz 0.11 0.17 0.24)"), pack(0, 130, 131, 1)));
      it("color(xyz-d65 0.11 0.17 0.24)", () =>
        strictEqual(
          parse("color(xyz-d65 0.11 0.17 0.24)"),
          pack(0, 130, 131, 1)
        ));
      it("color(xyz-d50 0.11 0.17 0.24)", () =>
        strictEqual(
          parse("color(xyz-d50 0.11 0.17 0.24)"),
          pack(0, 131, 150, 1)
        ));
      it("color(srgb-linear 0.23 0.59 0.13)", () =>
        strictEqual(
          parse("color(srgb-linear 0.23 0.59 0.13)"),
          pack(132, 202, 101, 1)
        ));
      it("color(display-p3 0.47 0.47 0.47)", () =>
        strictEqual(
          parse("color(display-p3 0.47 0.47 0.47)"),
          pack(120, 120, 120, 1)
        ));
      it("color(display-p3 1 1 1)", () =>
        strictEqual(parse("color(display-p3 1 1 1)"), pack(255, 255, 255, 1)));
      it("color(display-p3 -0.1 -0.1 -0.1) ", () =>
        strictEqual(
          parse("color(display-p3 -0.1 -0.1 -0.1)"),
          pack(0, 0, 0, 1)
        ));
      it("color(display-p3 0.238 0.532 0.611)", () =>
        strictEqual(
          parse("color(display-p3 0.238 0.532 0.611)"),
          pack(5, 138, 158, 1)
        ));
      it("color(display-p3 1 0 0)", () =>
        strictEqual(parse("color(display-p3 1 0 0)"), pack(255, 0, 0, 1)));
      it("color(display-p3 0 1 0)", () =>
        strictEqual(parse("color(display-p3 0 1 0)"), pack(0, 255, 0, 1)));
      it("color(display-p3 0 0 1)", () =>
        strictEqual(parse("color(display-p3 0 0 1)"), pack(0, 0, 255, 1)));
      it("color(a98-rgb 1 0.5 0)", () =>
        strictEqual(parse("color(a98-rgb 1 0.5 0)"), pack(255, 129, 0, 1)));
      it("color(a98-rgb 1 0.22548 0.9854)", () =>
        strictEqual(
          parse("color(a98-rgb 1 0.22548 0.9854)"),
          pack(255, 55, 255, 1)
        ));
      it("color(prophoto-rgb 1 0.5 0)", () =>
        strictEqual(parse("color(prophoto-rgb 1 0.5 0)"), pack(255, 99, 0, 1)));
      it("color(rec2020 0.17 0.31 0.5)", () =>
        strictEqual(
          parse("color(rec2020 0.17 0.31 0.5)"),
          pack(0, 97, 144, 1)
        ));
      it("color(rec2020 1 0 0)", () =>
        strictEqual(parse("color(rec2020 1 0 0)"), pack(255, 0, 0, 1)));
      it("color(rec2020 0 1 0)", () =>
        strictEqual(parse("color(rec2020 0 1 0)"), pack(0, 255, 0, 1)));
      it("color(rec2020 0 0 1)", () =>
        strictEqual(parse("color(rec2020 0 0 1)"), pack(0, 0, 255, 1)));
      it("color(from #0000FF srgb r g b)", () =>
        strictEqual(
          parse("color(from #0000FF srgb r b g)"),
          pack(0, 255, 0, 1)
        ));
      it("color(from #0000FF srgb b 0 0)", () =>
        strictEqual(
          parse("color(from #0000FF srgb b 0 0)"),
          pack(255, 0, 0, 1)
        ));
      it("color(from green srgb r g b)", () =>
        strictEqual(parse("color(from green srgb r g b)"), pack(0, 128, 0, 1)));
      it("color(from lime srgb r g b)", () =>
        strictEqual(parse("color(from lime srgb r g b)"), pack(0, 255, 0, 1)));
      it("color(from green srgb r calc(g * 2) b)", () =>
        strictEqual(
          parse("color(from green srgb r calc(g * 2) b)"),
          pack(0, 255, 0, 1)
        ));
      it("color(from hsl(0 100% 50%) xyz x y z)", () =>
        strictEqual(
          parse("color(from hsl(0 100% 50%) xyz x y z)"),
          pack(255, 0, 0, 1)
        ));
      it("color(from hsl(0 100% 50%) xyz 0.75 0.6554 0.1)", () =>
        strictEqual(
          parse("color(from hsl(0 100% 50%) xyz 0.75 0.6554 0.1)"),
          pack(255, 189, 31, 1)
        ));
      it("color(from hsl(0 100% 50%) srgb 0.749938 0 0.609579)", () =>
        strictEqual(
          parse("color(from hsl(0 100% 50%) srgb 0.749938 0 0.609579)"),
          pack(191, 0, 155, 1)
        ));
      it("color(from hsl(0 100% 50%) display-p3 r g b)", () =>
        strictEqual(
          parse("color(from hsl(0 100% 50%) display-p3 r g b)"),
          pack(255, 0, 0, 1)
        ));
      it("color(from lab(52.14 -26.38 -20.37) display-p3 r g b)", () =>
        strictEqual(
          parse("color(from lab(52.14 -26.38 -20.37) display-p3 r g b)"),
          pack(5, 138, 158, 1)
        ));
      it("color(from lab(52.14 -26.38 -20.37) display-p3 r g calc(r / 2))", () =>
        strictEqual(
          parse(
            "color(from lab(52.14 -26.38 -20.37) display-p3 r g calc(r / 2))"
          ),
          pack(5, 138, 0, 1)
        ));
      it("color(from lab(52.14 -26.38 -20.37) a98-rgb r g b)", () =>
        strictEqual(
          parse("color(from lab(52.14 -26.38 -20.37) a98-rgb r g b)"),
          pack(5, 138, 158, 1)
        ));
      it("color(from hsl(0 100% 50%) prophoto-rgb r g b)", () =>
        strictEqual(
          parse("color(from hsl(0 100% 50%) prophoto-rgb r g b)"),
          pack(255, 0, 0, 1)
        ));
      it("color(from hsl(0 100% 50%) prophoto-rgb calc(r / 2) g b)", () =>
        strictEqual(
          parse("color(from hsl(0 100% 50%) prophoto-rgb calc(r / 2) g b)"),
          pack(132, 83, 11, 1)
        ));
      it("color(from lab(52.14 -26.38 -20.37) rec2020 r g b)", () =>
        strictEqual(
          parse("color(from lab(52.14 -26.38 -20.37) rec2020 r g b)"),
          pack(5, 138, 158, 1)
        ));
      it("color(from hsl(0 100% 50%) rec2020 calc(r / 2) g 0)", () =>
        strictEqual(
          parse("color(from hsl(0 100% 50%) rec2020 calc(r / 2) g 0)"),
          pack(135, 68, 0, 1)
        ));
    });
    describe("util", () => {
      describe("isTransparent", () => {
        it("transparent", () =>
          strictEqual(isTransparent(parse("transparent")), true));
        it("#000", () => strictEqual(isTransparent(parse("#000")), false));
        it("#000f", () => strictEqual(isTransparent(parse("#000f")), false));
        it("#0001", () => strictEqual(isTransparent(parse("#0001")), false));
        it("#0000", () => strictEqual(isTransparent(parse("#0000")), true));
      });

      describe("toString", () => {
        it("transparent", () =>
          strictEqual(asString(parse("transparent")), "rgba(0,0,0,0)"));
        it("#000", () => strictEqual(asString(parse("#000")), "rgb(0,0,0)"));
        it("#000f", () => strictEqual(asString(parse("#000f")), "rgb(0,0,0)"));
        it("#000f", () =>
          strictEqual(asString(parse("#000c")), "rgba(0,0,0,0.8)"));
        it("#fff", () =>
          strictEqual(asString(parse("#fff")), "rgb(255,255,255)"));
        it("#ffff", () =>
          strictEqual(asString(parse("#ffff")), "rgb(255,255,255)"));
        it("#fffc", () =>
          strictEqual(asString(parse("#fffc")), "rgba(255,255,255,0.8)"));
      });
    });
  });
});
