import { Logger } from "./logger";
import { Cache, ResourceOptions } from "./cache-storage";
import { Bounds } from "../css/layout/bounds";
import { SkiaFontCollection } from "../fonts/font-collection";

export type ContextOptions = {
  logging: boolean;
  cache?: Cache;
} & ResourceOptions;

export class Context {
  private readonly instanceName = `#${Context.instanceCount++}`;
  readonly logger: Logger;
  readonly cache: Cache;

  private static instanceCount = 1;

  constructor(options: ContextOptions, public windowBounds: Bounds, public readonly fontCollection?: SkiaFontCollection) {
    this.logger = new Logger({
      id: this.instanceName,
      enabled: options.logging,
    });
    this.cache = options.cache ?? new Cache(this, options);
  }
}
