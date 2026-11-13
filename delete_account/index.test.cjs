const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

function createPage(post = async () => ({ data: { code: 200 } })) {
    const account = { value: ' 123456 ' };
    const password = { value: 'my-password' };
    const button = { disabled: false };
    const clearButton = { style: { display: 'block' } };
    const alerts = [];
    const requests = [];
    const elements = {
        '#account_input input': account,
        '#password_input input': password,
        '#submit-box button': button,
        '#account_input img': clearButton,
    };
    const context = vm.createContext({
        document: { querySelector: selector => elements[selector] },
        alert: message => alerts.push(message),
        confirm: () => true,
        axios: {
            post: (...args) => {
                requests.push(args);
                return post(...args);
            },
        },
    });
    vm.runInContext(source, context);
    return { context, account, password, button, clearButton, alerts, requests };
}

test('uses the API-prefixed endpoint and original password, then clears the form', async () => {
    const page = createPage();
    await page.context.onSubmit();
    assert.equal(page.requests.length, 1);
    const [url, body] = page.requests[0];
    assert.equal(url, 'https://api.chatstarapp.xyz/api/user/deleteAccountWithAccountPassword');
    assert.equal(body.username, '123456');
    assert.equal(body.password, 'my-password');
    assert.equal(page.account.value, '');
    assert.equal(page.password.value, '');
    assert.equal(page.clearButton.style.display, 'none');
    assert.equal(page.button.disabled, false);
    assert.deepEqual(page.alerts, ['Account deleted successfully']);
});

test('does not submit invalid or missing credentials', async () => {
    for (const [username, password] of [[' ', 'secret'], ['abc', 'secret'], ['123', '']]) {
        const page = createPage();
        page.account.value = username;
        page.password.value = password;
        await page.context.onSubmit();
        assert.equal(page.requests.length, 0);
        assert.equal(page.alerts.length, 1);
    }
});

test('does not submit when confirmation is canceled', async () => {
    const page = createPage();
    page.context.confirm = () => false;
    await page.context.onSubmit();
    assert.equal(page.requests.length, 0);
    assert.equal(page.button.disabled, false);
});

test('blocks duplicate requests while deletion is pending', async () => {
    let complete;
    const page = createPage(() => new Promise(resolve => { complete = resolve; }));
    const pending = page.context.onSubmit();
    assert.equal(page.button.disabled, true);
    await page.context.onSubmit();
    assert.equal(page.requests.length, 1);
    complete({ data: { code: 200 } });
    await pending;
    assert.equal(page.button.disabled, false);
});

for (const [name, error, expected] of [
    ['missing user', { response: { status: 404, data: { detail: 'User not found' } } }, 'User not found'],
    ['invalid password', { response: { status: 401, data: { detail: 'Invalid password' } } }, 'Invalid password'],
    ['validation error', { response: { status: 422, data: { detail: [{ msg: 'Invalid integer' }] } } }, 'Invalid account details. Please check your account ID and password.'],
    ['server error', { response: { status: 500, data: 'Internal Server Error' } }, 'Unable to delete your account. Please try again later.'],
    ['network error', new Error('Network Error'), 'Unable to connect to the server. Please check your connection and try again.'],
]) {
    test(`shows ${name} and allows retry without clearing credentials`, async () => {
        const page = createPage(async () => { throw error; });
        await page.context.onSubmit();
        assert.deepEqual(page.alerts, [expected]);
        assert.equal(page.account.value, ' 123456 ');
        assert.equal(page.password.value, 'my-password');
        assert.equal(page.button.disabled, false);
        await page.context.onSubmit();
        assert.equal(page.requests.length, 2);
    });
}

test('shows business errors and fallback messages without reporting success', async () => {
    for (const [data, expected] of [
        [{ code: 400, message: 'Deletion denied' }, 'Deletion denied'],
        [{ code: 400, msg: 'Account unavailable' }, 'Account unavailable'],
        [null, 'Unable to delete your account. Please try again.'],
    ]) {
        const page = createPage(async () => ({ data }));
        await page.context.onSubmit();
        assert.deepEqual(page.alerts, [expected]);
        assert.equal(page.password.value, 'my-password');
        assert.equal(page.button.disabled, false);
    }
});
