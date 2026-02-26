import { expect, test, type Page } from '@playwright/test'

const RESPONSE_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
}

const CATALOG_YAML = `tasks:
  classification:
    enabled: true
    title: Classification
  segmentation:
    enabled: true
    title: Segmentation
`

const SCHEMAS = [
  {
    taskType: 'classification',
    baseTaskType: 'classification',
    title: 'Classification',
    description: 'Image classification task',
    runner: {
      startMethod: 'python_script',
      target: 'backend/trainers/train_classification.py',
      targetEnvVar: null,
    },
    mlflow: {
      metric: 'val_accuracy',
      mode: 'max',
      modelName: 'classification-best-model',
      artifactPath: 'model',
    },
    fields: [
      {
        name: 'epochs',
        type: 'number',
        valueType: 'int',
        required: true,
        default: 10,
        label: 'Epochs',
        description: 'Number of epochs',
        group: 'train',
      },
    ],
  },
  {
    taskType: 'segmentation',
    baseTaskType: 'segmentation',
    title: 'Segmentation',
    description: 'Image segmentation task',
    runner: {
      startMethod: 'python_script',
      target: 'backend/trainers/train_segmentation.py',
      targetEnvVar: null,
    },
    mlflow: {
      metric: 'val_iou',
      mode: 'max',
      modelName: 'segmentation-best-model',
      artifactPath: 'model',
    },
    fields: [
      {
        name: 'epochs',
        type: 'number',
        valueType: 'int',
        required: true,
        default: 10,
        label: 'Epochs',
        description: 'Number of epochs',
        group: 'train',
      },
    ],
  },
]

const CATALOG_TASKS = [
  {
    taskType: 'classification',
    title: 'Classification',
    baseTaskType: 'classification',
    runnerTarget: 'backend/trainers/train_classification.py',
    runnerStartMethod: 'python_script',
    fieldOverrideCount: 0,
    fieldOrderCount: 0,
    extraFieldCount: 0,
  },
  {
    taskType: 'segmentation',
    title: 'Segmentation',
    baseTaskType: 'segmentation',
    runnerTarget: 'backend/trainers/train_segmentation.py',
    runnerStartMethod: 'python_script',
    fieldOverrideCount: 0,
    fieldOrderCount: 0,
    extraFieldCount: 0,
  },
]

const STUDIO_TASKS = [
  {
    taskType: 'classification',
    enabled: true,
    title: 'Classification',
    description: 'Image classification task',
    baseTaskType: 'classification',
    runnerStartMethod: 'python_script',
    runnerTarget: 'backend/trainers/train_classification.py',
    runnerTargetEnvVar: null,
    runnerCwd: null,
    mlflowMetric: 'val_accuracy',
    mlflowMode: 'max',
    mlflowModelName: 'classification-best-model',
    mlflowArtifactPath: 'model',
    fieldOrder: [],
    hiddenFields: [],
    fieldOverrides: {},
    extraFields: [],
  },
]

const STUDIO_REGISTRY_MODELS = [
  {
    id: 'classification-model',
    title: 'Classification Default',
    description: 'Default classification registry model',
    taskType: 'classification',
    modelName: 'classification-best-model',
    defaultStage: 'release',
    defaultVersion: 'latest',
    defaultDestinationDir: './outputs/models',
  },
]

async function mockApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const { pathname } = new URL(request.url())

    const fulfill = (body: unknown) =>
      route.fulfill({
        status: 200,
        headers: RESPONSE_HEADERS,
        body: JSON.stringify(body),
      })

    if (method === 'GET' && pathname.endsWith('/config-schemas')) {
      return fulfill({ items: SCHEMAS })
    }

    if (method === 'GET' && pathname.endsWith('/catalog')) {
      return fulfill({
        path: 'backend/config/training_catalog.yaml',
        exists: true,
        modifiedAt: '2026-02-26T12:00:00Z',
        content: CATALOG_YAML,
        taskCount: CATALOG_TASKS.length,
        tasks: CATALOG_TASKS,
      })
    }

    if (method === 'GET' && pathname.endsWith('/catalog/studio')) {
      return fulfill({
        path: 'backend/config/training_catalog.yaml',
        exists: true,
        modifiedAt: '2026-02-26T12:00:00Z',
        taskCount: STUDIO_TASKS.length,
        registryModelCount: STUDIO_REGISTRY_MODELS.length,
        tasks: STUDIO_TASKS,
        registryModels: STUDIO_REGISTRY_MODELS,
      })
    }

    if (method === 'GET' && pathname.endsWith('/runs')) {
      return fulfill({ items: [] })
    }

    if (method === 'GET' && pathname.endsWith('/mlflow/runs')) {
      return fulfill({ items: [] })
    }

    if (method === 'GET' && pathname.endsWith('/mlflow/experiments')) {
      return fulfill({
        items: [
          {
            experimentId: '1',
            name: 'void-train-manager',
            lifecycleStage: 'active',
          },
        ],
      })
    }

    if (method === 'GET' && pathname.endsWith('/serving/ray')) {
      return fulfill({ items: [] })
    }

    if (method === 'GET' && pathname.endsWith('/serving/local')) {
      return fulfill({ items: [] })
    }

    if (method === 'GET' && pathname.endsWith('/ftp-registry/catalog-models')) {
      return fulfill({ items: [] })
    }

    return route.fulfill({
      status: 404,
      headers: RESPONSE_HEADERS,
      body: JSON.stringify({ detail: `Unmocked endpoint: ${method} ${pathname}` }),
    })
  })
}

test('renders grouped sidebar folders and switches tabs', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Workspace Map' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Workspace/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Catalog Files/i })).toBeVisible()

  const operationsTab = page.getByRole('tab', { name: /Operations/i })
  await expect(operationsTab).toHaveAttribute('aria-selected', 'true')

  await page.getByRole('tab', { name: /YAML Catalog/i }).click()
  await expect(page.locator('#panel-catalog')).toBeVisible()
  await expect(page.locator('#panel-catalog').getByRole('heading', { name: 'Catalog Manager' })).toBeVisible()

  await page.getByRole('tab', { name: /YAML Studio/i }).click()
  await expect(page.locator('#panel-studio')).toBeVisible()
  await expect(page.locator('#panel-studio').getByRole('heading', { name: 'YAML Studio (Easy Mode)' })).toBeVisible()
})

test('keeps the current tab when unsaved catalog changes are rejected', async ({ page }) => {
  await mockApi(page)
  await page.goto('/?tab=catalog')

  const editor = page.getByLabel('training catalog yaml editor')
  await editor.fill(`${CATALOG_YAML}\n# unsaved change`)

  let promptText = ''
  page.once('dialog', async (dialog) => {
    promptText = dialog.message()
    await dialog.dismiss()
  })

  await page.getByRole('tab', { name: /Operations/i }).click()

  await expect(page.getByRole('tab', { name: /YAML Catalog/i })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#panel-catalog')).toBeVisible()
  expect(promptText).toContain('저장되지 않은 YAML 변경사항이 있습니다')
})
