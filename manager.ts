#!/usr/bin/env node

import {checkbox, select, confirm} from '@inquirer/prompts';
import simpleGit from "simple-git";
import semver from "semver";

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
        await Promise.all(deleteTags.map(tag => deleteLocalTag(tag)));
    }

    for (const remote of env.filter(e => e !== 'local')) {
        await Promise.all(deleteTags.map(tag => deleteRemoteTag(remote, tag)));
    }
}

const deleteLocalTag = async (tag: string) => {
    await git.tag(['-d', tag])
    console.log(`[Local] delete ${tag}`)
}

const deleteRemoteTag = async (remote: string, tag: string) => {
    await git.push(remote, `:refs/tags/${tag}`)
    console.log(`[${remote}] delete ${tag}`)
}

const createLocalTag = async (tag: string) => {
    await git.tag(['-a', tag, '-m', tag])
    console.log(`[Local] create ${tag}`)
}

const createRemoteTag = async (remote: string, tag: string) => {
    await git.push(remote, tag)
    console.log(`[${remote}] create ${tag}`)
}

const releaseVersion = async () => {
    const allTag = await git.tags(['--sort=-creatordate']);
    const tagList = allTag.all;

    if (tagList.length === 0) {
        return;
    }

    const tag = await select({
        message: 'Select a previous tags',
        choices: tagList.map(tag => ({name: tag, value: tag})),
    })

    const previousCleanTag = semver.clean(tag, {loose: true});
    if (!previousCleanTag) {
        console.error('Invalid tag');
        return;
    }
    const lastPrerelease = semver.prerelease(previousCleanTag);
    const candidates : string[] = [];
    // 이전 버전이 rc 버전인 경우
    if (lastPrerelease != null) {
        const prereleaseVersion = parseInt(`${lastPrerelease[1]}`)
        candidates.push(`v${semver.coerce(previousCleanTag)}-rc.${prereleaseVersion + 1}`)
    // 정식 버전인 경우
    } else {
        candidates.push(`v${semver.coerce(semver.inc(previousCleanTag, 'patch'))}-rc.1`)
        candidates.push(`v${semver.coerce(semver.inc(previousCleanTag, 'minor'))}-rc.1`)
        candidates.push(`v${semver.coerce(semver.inc(previousCleanTag, 'major'))}-rc.1`)
    }
    // @ts-ignore
    candidates.push(...[
        "v" + semver.inc(previousCleanTag, 'patch'),
        "v" + semver.inc(previousCleanTag, 'minor'),
        "v" + semver.inc(previousCleanTag, 'major'),
    ].filter(tag => tag !== null));

    const chosenTag = await select({
        message: `Select a version${previousCleanTag}`,
        choices: candidates.map(tag => ({name: tag, value: tag})),
    })

    const check = await confirm({
        message: `Are you sure to release ${tag} -> ${chosenTag}? (Default: yes)`,
        default: true,
    })
    if (!check) {
        return;
    }

    await createLocalTag(chosenTag);
    await createRemoteTag('origin', chosenTag);
}

const exit = () => process.exit(0);

const main = async () => {
    const action = await select({
        message: 'Select a action',
        choices: [
            {name: "Delete tags", value: deleteTags},
            {name: "Release Version", value: releaseVersion},
            {name: "Exit", value: exit}
        ],
    })
    await action();
}

main().catch(err => console.error('Error:', err));
