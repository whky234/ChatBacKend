const dns = require('dns');

const checkInternetConnection = () => {
    return new Promise((resolve) => {
        dns.lookup('google.com', (err) => {
            resolve(!err); // Returns `true` if connected, `false` otherwise
        });
    });
};

module.exports = checkInternetConnection;
