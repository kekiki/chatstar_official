var passwordShow = false;
var requestUrl = 'https://api.chatstarapp.xyz/api/user/deleteAccountWithAccountPassword';
var isSubmitting = false;

function toggleDeleteButton(input) {
    var deleteButton = document.querySelector('#account_input img');
    if (input.value) {
        deleteButton.style.display = 'block';
    } else {
        deleteButton.style.display = 'none';
    }
}

function deleteInput(button) {
    var input = button.previousElementSibling;
    input.value = '';
    button.style.display = 'none';
}
function onTogglePasswordShow(img) {
    var input = document.querySelector('#password_input input');
    if (passwordShow) {
        img.setAttribute('src', 'delete_account/assets/eye_off.webp');
        input.setAttribute('type', 'password');
    } else {
        img.setAttribute('src', 'delete_account/assets/eye_on.webp');
        input.setAttribute('type', 'text');
    }
    passwordShow = !passwordShow;
}
function getDeleteErrorMessage(data) {
    if (!data || typeof data !== 'object') {
        return '';
    }
    if (typeof data.detail === 'string' && data.detail) {
        return data.detail;
    }
    if (Array.isArray(data.detail)) {
        return 'Invalid account details. Please check your account ID and password.';
    }
    return (typeof data.message === 'string' && data.message) ||
        (typeof data.msg === 'string' && data.msg) || '';
}

async function onSubmit() {
    if (isSubmitting) {
        return;
    }

    var passwordInput = document.querySelector('#password_input input');
    var accountInput = document.querySelector('#account_input input');
    var password = passwordInput.value;
    var username = accountInput.value.trim();
    if (username === '') {
        alert('Please enter your account ID');
        return;
    }
    if (!/^\d+$/.test(username)) {
        alert('Please enter a valid numeric account ID');
        return;
    }
    if (password === '') {
        alert('Please enter your password');
        return;
    }
    if (!confirm('Please confirm your operation, your account will be destroyed immediately after cancellation!')) {
        return;
    }

    var submitButton = document.querySelector('#submit-box button');
    isSubmitting = true;
    submitButton.disabled = true;

    try {
        // The API verifies the original password against its server-side hash.
        var response = await axios.post(requestUrl, {
            username: username,
            password: password,
        });
        var data = response.data;
        if (data && data.code === 200) {
            alert('Account deleted successfully');
            passwordInput.value = '';
            accountInput.value = '';
            toggleDeleteButton(accountInput);
        } else {
            alert(getDeleteErrorMessage(data) || 'Unable to delete your account. Please try again.');
        }
    } catch (err) {
        if (err.response) {
            alert(getDeleteErrorMessage(err.response.data) ||
                'Unable to delete your account. Please try again later.');
        } else {
            alert('Unable to connect to the server. Please check your connection and try again.');
        }
    } finally {
        isSubmitting = false;
        submitButton.disabled = false;
    }
}