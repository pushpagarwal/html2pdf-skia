// @ts-ignore
import { default as platform } from "platform";
// @ts-ignore
import Promise from "es6-promise";

// @ts-ignore
window.Promise = Promise;

// Basic test setup without reftest dependencies
describe("HTML2PDF Basic Tests", function () {
  this.timeout(60000);
  this.retries(2);

  it("Should be able to create a canvas", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    // Basic canvas test
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    try {
      ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) {
      throw new Error("Canvas is tainted");
    }
  });

  it("Should have platform information available", () => {
    if (!platform) {
      throw new Error("Platform not available");
    }
    if (!platform.name) {
      throw new Error("Platform name not available");
    }
  });
});
