'use strict'

const util = require('util')
const { filesystem, colors, print, path, system, prompt, strings } = require('@codedungeon/gunner')
const ListPrompt = require('inquirer/lib/prompts/list')
const Listr = require('listr')
const split = require('split')
const execa = require('execa')
const { merge, throwError } = require('rxjs')
const { catchError, filter } = require('rxjs/operators')
const streamToObservable = require('@samverschueren/stream-to-observable')
const pluginUtils = require('./plugin-utils')
const github = require('./github')

const prerequisiteTasks = require('./plugin-release/prerequisite-tasks')
const gitTasks = require('./plugin-release/git-tasks')
const updateVersionTasks = require('./plugin-release/update-version-tasks')
const releaseTasks = require('./plugin-release/release-tasks')
const releasePrompts = require('./plugin-release/release-prompts')

const exec = (cmd, args) => {
  const cp = execa(cmd, args)

  return merge(streamToObservable(cp.stdout.pipe(split())), streamToObservable(cp.stderr.pipe(split())), cp).pipe(
    filter(Boolean),
  )
}

module.exports = {
  run: async (pluginName = '', pluginVersion = '', args = {}) => {
    const runTests = !args?.noTests
    const preview = args?.preview
    const testRunner = `./node_modules/.bin/jest`
    const testCommand = ['run', 'test:dev', pluginName]

    if (args.preview) {
      print.info('Preview Mode')
      console.log('')
    }

    const tasks = new Listr(
      [
        {
          title: 'Prerequisite check',
          skip: () => {
            if (preview) {
              return `[Preview] all validation`
            }
          },
          task: () => prerequisiteTasks(pluginName, args),
        },
        {
          title: 'Github check',
          skip: () => {
            if (preview) {
              return `[Preview] github tasks`
            }
          },
          task: () => gitTasks(pluginName, args),
        },
      ],
      { showSubtaks: false },
    )

    if (runTests) {
      tasks.add([
        {
          title: 'Running tests',
          enabled: () => {
            return true
          },
          skip: () => {
            if (preview) {
              return `[Preview] npm run test:dev ${pluginName}`
            }
          },
          task: () =>
            exec('npm', testCommand).pipe(
              catchError(async (error) => {
                console.log(error.stderr)
                console.log('')
                print.error('Testing failed, release aborted', 'ERROR')
                process.exit()
                return throwError(error)
              }),
            ),
        },
      ])
    }

    tasks.add([
      {
        title: 'Updating version',
        skip: () => {
          if (args.preview) {
            return `[Preview] update version ${pluginName} ${pluginVersion}`
          }
        },
        task: () => {
          const result = updateVersionTasks(pluginName, pluginVersion)
        },
      },
    ])

    tasks.add([
      {
        title: 'Publishing Release',
        skip: async () => {
          const cmd = await releaseTasks(pluginName, pluginVersion, args)
          if (args.preview) {
            return cmd
          }
        },
        task: async () => {
          const cmd = await releaseTasks(pluginName, pluginVersion, args)
        },
      },
    ])

    const result = await tasks.run()
    console.log('')
    if (preview) {
      print.note(`${pluginName} ${pluginVersion} Completed Successfully`, 'PREVIEW')
    } else {
      print.success(`${pluginName} ${pluginVersion} Released Successfully`, 'SUCCESS')
    }
  },
}
