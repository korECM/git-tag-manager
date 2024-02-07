#!/usr/bin/env node

import {checkbox, select} from '@inquirer/prompts';
import simpleGit from "simple-git";

const git = simpleGit();

const deleteTags = async () => {
    const tag = await git.tags(['--sort=-creatordate']);
    const tagList = tag.all;

    if (tagList.length === 0) {
        return;
    }

    const deleteTags = await checkbox({
        message: 'Select a tags',
        choices: tagList.map(tag => ({name: tag, value: tag})),
    })

    const remotes = await git.getRemotes(true);

    const env = await checkbox({
        message: 'Select a env',
        choices: [{name: "local", value: "local"}, ...remotes.map(remote => ({name: remote.name, value: remote.name}))],
    })

    if (env.includes('local')) {
        await Promise.all(deleteTags.map(tag => git.tag(['-d', tag])));
    }

    for (const remote of env.filter(e => e !== 'local')) {
        await Promise.all(deleteTags.map(tag => git.push(remote, `:refs/tags/${tag}`)));
    }
}

const exit = () => process.exit(0);

const main = async () => {
    const action = await select({
        message: 'Select a action',
        choices: [{name: "Delete tags", value: deleteTags}, {name: "Exit", value: exit}],
    })
    await action();
}

main().catch(err => console.error('Error:', err));