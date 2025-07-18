import CanvasKitInit from '@rollerbird/canvaskit-wasm-pdf';
import { CanvasKit } from '@rollerbird/canvaskit-wasm-pdf';


/**
 * Cached CanvasKit instance to avoid multiple loads
 */
let canvasKitInstance: CanvasKit | null = null;

/**
 * Promise to track the loading state
 */
let canvasKitPromise: Promise<CanvasKit> | null = null;

/**
 * Configuration options for CanvasKit loading
 */
export interface CanvasKitLoadOptions {
    /**
     * Custom WASM binary URL. If not provided, uses the bundled WASM file.
     */
    wasmBinaryUrl: string;
    
    /**
     * Timeout in milliseconds for loading CanvasKit (default: 30000)
     */
    timeout?: number;
    
    /**
     * Whether to log loading progress
     */
    verbose?: boolean;
}

/**
 * Loads CanvasKit WASM module and returns the CanvasKit instance
 * 
 * @param options - Configuration options for loading CanvasKit
 * @returns Promise that resolves to the CanvasKit instance
 */
export const loadCanvasKit = async (options: CanvasKitLoadOptions): Promise<CanvasKit> => {
    // Return cached instance if already loaded
    if (canvasKitInstance) {
        if (options.verbose) {
            console.log('Returning cached CanvasKit instance');
        }
        return canvasKitInstance;
    }
    
    // Return existing promise if already loading
    if (canvasKitPromise) {
        if (options.verbose) {
            console.log('CanvasKit already loading, waiting for existing promise');
        }
        return canvasKitPromise;
    }
    
    // Create new loading promise
    canvasKitPromise = new Promise<CanvasKit>(async (resolve, reject) => {
        const timeout = options.timeout || 30000;
        
        // Set up timeout
        const timeoutId = setTimeout(() => {
            reject(new Error(`CanvasKit loading timed out after ${timeout}ms`));
        }, timeout);
        
        try {
            if (options.verbose) {
                console.log('Loading CanvasKit WASM...');
            }
            
            // Use the bundled WASM URL or custom URL
            const wasmUrl = options.wasmBinaryUrl;
            
            if (options.verbose) {
                console.log('WASM URL:', wasmUrl);
            }
            
            // Initialize CanvasKit with the WASM file URL
            const canvasKit = await CanvasKitInit({
                locateFile: (file: string) => {
                    if (file.endsWith('.wasm')) {
                        return wasmUrl;
                    }
                    // For other files, return as-is (shouldn't happen with our setup)
                    return file;
                }
            });
            
            // Clear timeout
            clearTimeout(timeoutId);
            
            if (!canvasKit) {
                throw new Error('CanvasKit initialization returned null');
            }
            
            // Cache the instance
            canvasKitInstance = canvasKit;
            
            if (options.verbose) {
                console.log('CanvasKit WASM loaded successfully');
            }
            
            resolve(canvasKit);
            
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('Failed to load CanvasKit WASM:', error);
            
            // Reset the promise so it can be retried
            canvasKitPromise = null;
            
            reject(new Error(`Failed to load CanvasKit WASM: ${error}`));
        }
    });
    
    return canvasKitPromise;
};

/**
 * Checks if CanvasKit is already loaded
 * 
 * @returns True if CanvasKit is loaded, false otherwise
 */
export const isCanvasKitLoaded = (): boolean => {
    return canvasKitInstance !== null;
};

/**
 * Gets the cached CanvasKit instance without loading
 * 
 * @returns The cached CanvasKit instance or null if not loaded
 */
export const getCanvasKitInstance = (): CanvasKit | null => {
    return canvasKitInstance;
};

/**
 * Preloads CanvasKit WASM in the background
 * This can be called early in the application lifecycle to improve performance
 * 
 * @param options - Configuration options for loading CanvasKit
 * @returns Promise that resolves when CanvasKit is loaded
 */
export const preloadCanvasKit = async (options: CanvasKitLoadOptions): Promise<void> => {
    try {
        await loadCanvasKit({ ...options, verbose: false });
        console.log('CanvasKit preloaded successfully');
    } catch (error) {
        console.warn('Failed to preload CanvasKit:', error);
        throw error;
    }
};

/**
 * Resets the CanvasKit loader state
 * This is mainly useful for testing or when you need to reload CanvasKit
 */
export const resetCanvasKitLoader = (): void => {
    canvasKitInstance = null;
    canvasKitPromise = null;
};

/**
 * Utility function to check if CanvasKit is supported in the current environment
 * 
 * @returns True if CanvasKit is likely to be supported
 */
export const isCanvasKitSupported = (): boolean => {
    // Check for WebAssembly support
    if (typeof WebAssembly !== 'object' || typeof WebAssembly.instantiate !== 'function') {
        console.warn('WebAssembly is not supported in this environment');
        return false;
    }
    
    // Check for Canvas support
    if (typeof HTMLCanvasElement === 'undefined') {
        console.warn('Canvas is not supported in this environment');
        return false;
    }
    
    return true;
};

