# Adding a GitLab proof

Let's add a decentralized GitLab proof to your OpenPGP keys. This will also work on self-hosted instances.

[[toc]]

## Post a GitLab proof message

Log in to [gitlab.com](https://gitlab.com) or any other GitLab instance and click on **New project**.

Set the project name to a name of your choosing.

Set the project slug to **gitlab_proof**.

Set the project description to (make sure to replace FINGERPRINT):

```
[Verifying my OpenPGP key: openpgp4fpr:FINGERPRINT]
```

After creating the project, copy the link to the project.

## Update the PGP key

First, edit the key (make sure to replace FINGERPRINT):

`gpg --edit-key FINGERPRINT`

Add a new notation:

`notation`

Enter the notation (make sure to update with the link to the project copied above):

`proof@metacode.biz=https://gitlab.example.com/USERNAME/gitlab_proof`

Save the key:

`save`

Upload the key to WKD or use the following command to upload the key to [keys.openpgp.org](https://keys.openpgp.org) (make sure to replace FINGERPRINT):

`gpg --keyserver hkps://keys.openpgp.org --send-keys FINGERPRINT`

And you're done! Reload your profile page, it should now show a verified GitLab account.
