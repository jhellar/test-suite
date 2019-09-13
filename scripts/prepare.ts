import * as Api from 'kubernetes-client';
import * as Mustache from 'mustache';
import * as fs from 'fs';
import * as path from 'path';

const mobileClientCRD = require('../crds/mobile-client-crd');
 
const Client = Api.Client1_13;
const config = Api.config;
const client = new Client({ config: config.fromKubeconfig(), version: '1.11' });

client.addCustomResourceDefinition(mobileClientCRD);

const mobileClientCRTemplate = fs.readFileSync(
  path.resolve(__dirname, '../templates/mobile-client.json'),
  'utf8'
);

const appNamePrefix = 'test-';
const appName = `${appNamePrefix}${Math.random().toString(36).substring(7)}`;

const mobileClientCR = Mustache.render(mobileClientCRTemplate, { appName });

(async function() {
  let mobileClient;
  let mdcNamespace;
  const namespaces = [
    'mobile-developer-console',
    'openshift-mobile-developer-console'
  ];
  while (true) {
    mdcNamespace = namespaces.pop();
    if (!mdcNamespace) {
      throw new Error('Can not access MDC namespace');
    }
    try {
      mobileClient = await client
        .apis['mdc.aerogear.org']
        .v1alpha1
        .namespaces(mdcNamespace)
        .mobileclients
        .post({ body: JSON.parse(mobileClientCR) });
      break;
    } catch (_) {}
  }

  const mobileClients = await client
    .apis['mdc.aerogear.org']
    .v1alpha1
    .namespaces(mdcNamespace)
    .mobileclients
    .get();

  const appsToDelete = mobileClients.body.items
    .map(i => i.spec.name)
    .filter(name => name !== appName && name.startsWith(appNamePrefix));

  for (const app of appsToDelete) {
    await client
      .apis['mdc.aerogear.org']
      .v1alpha1
      .namespaces(mdcNamespace)
      .mobileclients(app)
      .delete();
  }

  console.log(JSON.stringify(mobileClient, null, 2));
})();