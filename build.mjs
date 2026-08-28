import * as esbuild from "esbuild";
import less from "less";
import fs from "node:fs/promises";

const isWatch = process.argv.includes("--watch");

const lessPlugin = {
    name: "less",
    setup(build) {
        build.onLoad({
            filter: /\.less$/
        }, async (args) => {
            const source = await fs.readFile(
                args.path,
                "utf8"
            );
            const result = await less.render(
                source,
                {
                    filename: args.path
                }
            );

            return {
                contents: result.css,
                loader: "css"
            };
        });
    }
};

const foundryAssetsPlugin = {
    name: "foundry-assets",

    setup(build) {
        build.onResolve(
            {
                filter: /^\/(modules|systems)\//
            },
            args => ({
                path: args.path,
                external: true
            })
        );
    }
};


const config = {
    entryPoints: [
        "src/daggerheart-card-deck-hud.js",
        "src/styles/daggerheart-card-deck-hud.less"
    ],
    bundle: true,
    outdir: "dist",
    format: "esm",
    sourcemap: true,
    plugins: [
        foundryAssetsPlugin,
        lessPlugin
    ],
    logLevel: "info"
};


if (isWatch) {
    const context = await esbuild.context(config);
    await context.watch();
    console.log("Watching JS and Less files...");
} else {
    await esbuild.build(config);
    console.log("Build complete.");
}