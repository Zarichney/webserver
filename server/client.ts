import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from '../client/components/app/app.module';
import { APP_BASE_HREF } from '@angular/common';

const protocol = location.protocol === 'https:' ? 'https' : 'http';
const port = location.port ? `:${location.port}` : '';
const url = `${protocol}://${location.hostname}${port}`;

platformBrowserDynamic().bootstrapModule(AppModule, {
  providers: [{ provide: APP_BASE_HREF, useValue: url }]
})
.catch(err => console.error(err));
