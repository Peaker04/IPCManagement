import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../fixtures/mrxTest';
import { CANONICAL_ROUTES } from '../../../src/routes/routeRegistry';

test('@MRX-UiAcceptance divider pixels on operational and shared pages', async ({adminPage: page}) => {
  test.setTimeout(420_000);
  const modes = (items: string[]) => items.includes('MATERIAL_RECONCILIATION') || items.includes('SHARED');
  const routes = CANONICAL_ROUTES.filter(r => modes(r.modes) && !['/login','/forbidden'].includes(r.path))
    .flatMap(r => r.leaves ? r.leaves.filter(l => modes(l.modes)).map(l => l.to) : [r.path]);
  const results = [];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('aside').first()).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(new URL(route, 'http://localhost').pathname);
    // Hold a cold read long enough to inspect the painted loading state.
    await page.route('**/api/**', async request => {
      if (request.request().method() === 'GET') await new Promise(r => setTimeout(r, 300));
      await request.continue();
    });
    await page.evaluate(() => {
      for (const key of Object.keys(sessionStorage)) if (/^ipc_(l2_cache|snapshot):/.test(key)) sessionStorage.removeItem(key);
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('aside').first().waitFor();
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const png = await page.screenshot();
      samples.push(await page.evaluate(async encoded => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + encoded;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const pixels = ctx.getImageData(0,0,img.width,img.height).data;
        const rgb = (x:number,y:number) => Array.from(pixels.slice((y*img.width+x)*4,(y*img.width+x)*4+3)).join(',');
        const x = Math.floor(document.querySelector('aside')!.getBoundingClientRect().right)-1;
        const lines: number[] = [];
        for (let y=2;y<img.height-1;y++) {
          const positions=[0.36,0.52,0.69,0.84,0.96].map(f => Math.floor(x+(img.width-x)*f));
          const colors=positions.map(px => rgb(px,y));
          if(colors.every(c => c===colors[0]) && positions.every(px => rgb(px,y-1)!==colors[0] && rgb(px,y+1)!==colors[0])) lines.push(y);
        }
        const pulseBorders = [...document.querySelectorAll('[data-skeleton-kind] *')].filter(el => {
          const style = getComputedStyle(el);
          return style.animationName !== 'none' && ['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].some(k => parseFloat(style[k as 'borderTopWidth'])>0);
        }).length;
        return { sidebar:rgb(x,Math.floor(img.height/2)), lines, pulseBorders };
      }, png.toString('base64')));
    }
    await page.unrouteAll({ behavior: 'wait' });
    for (const width of [960,1024,1280,1366,1440,1920]) {
      await page.setViewportSize({width,height:900});
      const header = page.locator('header').filter({has:page.getByRole('heading',{level:1})}).first();
      await expect(header, route).toBeVisible();
      for (const control of await header.locator('button:enabled:visible,input:enabled:visible,select:enabled:visible').all()) {
        await expect(control, route).toHaveAccessibleName(/\S/);
        await control.click({trial:true,timeout:3000});
      }
    }
    const search = page.getByRole('searchbox').first();
    if (await search.isVisible() && await search.isEnabled()) {
      const clear = search.locator('..').getByRole('button', {name:/Xóa tìm/});
      if (await clear.count()) {
        await search.fill('abc');
        await clear.click();
        await expect(search).toHaveValue('');
        await expect(search).toBeFocused();
      }
    }
    // Exercise read controls; never submit business writes or change operation mode.
    const interactions: string[] = [];
    const filterMeasurements: Array<{ label: string; hadResolvedRows: boolean; skeletonFrames: number }> = [];
    const header = page.locator('header').filter({has:page.getByRole('heading',{level:1})}).first();
    const initialHeader = await header.boundingBox();
    const selectLabels = await header.locator('select:enabled:visible').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')!));
    for (const label of selectLabels) {
      const select = header.getByRole('combobox', { name: label, exact: true });
      await expect(select).toBeEnabled();
      const original = await select.inputValue();
      const alternative = await select.locator('option:enabled').evaluateAll((options, value) =>
        options.map(o => (o as HTMLOptionElement).value).find(v => v && v !== value && !v.startsWith('__')), original);
      if (!alternative) continue;
      const hadResolvedRows = await page.locator('tbody tr').count() > 0 && await page.locator('[data-skeleton-kind]').count() === 0;
      const transitionFrames = page.evaluate(async () => {
        const frames: boolean[] = [];
        for (let i = 0; i < 45; i++) {
          await new Promise(requestAnimationFrame);
          frames.push(Boolean(document.querySelector('[data-skeleton-kind]')));
        }
        return frames;
      });
      await select.selectOption(alternative, {timeout:15000});
      await expect(header).toBeVisible();
      const observedFrames = await transitionFrames;
      filterMeasurements.push({ label, hadResolvedRows, skeletonFrames: observedFrames.filter(Boolean).length });
      if (hadResolvedRows) {
        expect(observedFrames.every(skeleton => !skeleton), `${route}: ${label} replaced resolved rows with a skeleton`).toBe(true);
      }
      await select.selectOption(original, {timeout:15000});
      await expect(select).toHaveValue(original);
      expect((await header.boundingBox())!.y).toBe(initialHeader!.y);
      interactions.push('select:' + await select.getAttribute('aria-label'));
    }
    const refresh = header.getByRole('button', {name:'Làm mới', exact:true});
    if (await refresh.isVisible() && await refresh.isEnabled()) {
      await refresh.click();
      await expect(header).toBeVisible();
      await expect(refresh).toBeEnabled();
      interactions.push('refresh');
    }
    const calendarTrigger = header.getByRole('button', {name:'Mở lịch chọn ngày'}).first();
    if (await calendarTrigger.isVisible() && await calendarTrigger.isEnabled()) {
      for (const reducedMotion of ['no-preference', 'reduce'] as const) {
        await page.emulateMedia({reducedMotion});
        await calendarTrigger.click();
        const calendar = page.getByRole('dialog', {name:'Lịch chọn ngày'});
        await expect(calendar).toBeVisible();
        const duration = await calendar.evaluate(el => parseFloat(getComputedStyle(el).animationDuration));
        expect(duration).toBeLessThanOrEqual(reducedMotion === 'reduce' ? 0.00001 : 0.15);
        await calendar.getByRole('button', {name:'Tháng sau',exact:true}).click();
        await calendar.getByRole('button', {name:'Tháng trước',exact:true}).click();
        await page.keyboard.press('Escape');
        await expect(calendar).not.toBeVisible();
        await expect(calendarTrigger).toBeFocused();
      }
      await page.emulateMedia({reducedMotion:'no-preference'});
      interactions.push('calendar navigation / escape / reduced motion');
    }
    fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, `controls-${routes.indexOf(route)}.json`),JSON.stringify({route,interactions,filterMeasurements}));
    results.push({route,samples});
    fs.writeFileSync(path.join(process.env.MRX_E2E_ARTIFACT_DIRECTORY!, 'divider-pixels.json'),JSON.stringify(results));
    expect(samples.every(s => s.pulseBorders===0),route).toBe(true);
    expect(new Set(samples.map(s=>s.sidebar)).size,route).toBe(1);
  }
});
