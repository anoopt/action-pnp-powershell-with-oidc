# PnP PowerShell with OIDC
This GitHub Action shows how to use PnP PowerShell with OpenID Connect (OIDC) method of authentication using Azure Service Principal with a Federated Identity Credential.

This Action connects to the specified site using [Connect-PnPOnline](https://pnp.github.io/powershell/cmdlets/Connect-PnPOnline.html) and then executes the specified PnP PowerShell script.

In this action, there is no client secret needed to authenticate to a site. This is done with the help of federated identity credential which is used to get an access token and authenticate to a site. The federated identity credential creates a trust relationship between an application and an external identity provider (IdP) - which is GitHub in this case. For more information, see [Workload identity federation](https://learn.microsoft.com/en-us/azure/active-directory/develop/workload-identity-federation) and [Configure an app to trust an external identity provider](https://learn.microsoft.com/en-us/azure/active-directory/develop/workload-identity-federation-create-trust?pivots=identity-wif-apps-methods-azp).

## Usage
```yaml
name: PnP PowerShell with OIDC
uses: anoopt/action-pnp-powershell-with-oidc@v1.2.0
with:
    TENANT_ID: ${{ secrets.tenantId }}
    TENANT_NAME: ${{ secrets.tenantName }}
    CLIENT_ID: ${{ secrets.clientId }}
    SITE_URL: "https://contoso.sharepoint.com/sites/intranet"
    PNP_POWERSHELL_SCRIPT: |
        $addedApp = Add-PnPApp -Path 'sharepoint/solution/${{ env.SPPKG_FILE_NAME }}' -Scope Site -Overwrite
        Install-PnPApp -Identity $addedApp.Id -Scope Site
```

## Pre-requisites

1. A service principal with a federated identity credential needs to be created in Azure Active Directory in order to use this Action. Follow [this](#configure-a-service-principal-with-a-federated-credential-to-use-oidc-based-authentication) guidance to create a Federated Credential associated with your AD App (Service Principal). This is needed to establish OIDC trust between GitHub deployment workflows and the specific Azure resources scoped by the service principal.
2. In your GitHub workflow, Set `permissions:` with `id-token: write` at workflow level or job level based on whether the OIDC token needs to be auto-generated for all Jobs or a specific Job. 
3. Within the Job deploying to Azure, add anoopt/action-pnp-powershell-federated action and pass the `TENANT_ID`, `TENANT_NAME`, `SITE_URL` and `CLIENT_ID` of the Azure service principal associated with an OIDC Federated Identity Credential credeted in step (i)

### Configure a service principal with a Federated Credential to use OIDC based authentication

We can add federated credentials in the Azure portal or with the Microsoft Graph REST API.

#### Option 1 - Azure portal
1. [Register an application](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app) in Azure Portal
2. Within the registered application, Go to **Certificates & secrets**.  
3. In the **Federated credentials** tab, select **Add credential**.  
4. The **Add a credential** blade opens.
5. In the **Federated credential scenario** box select **GitHub actions deploying Azure resources**.
6. Specify the **Organization** and **Repository** for your GitHub Actions workflow which needs to access the Azure resources scoped by this App (Service Principal) 
7. For **Entity type**, select **Environment**, **Branch**, **Pull request**, or **Tag** and specify the value, based on how you have configured the trigger for your GitHub workflow. For a more detailed overview, see [GitHub OIDC guidance]( https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect#defining-[…]dc-claims). 
8. Add a **Name** for the federated credential.
9. Click **Add** to configure the federated credential.
10. Make sure the above created application has the `contributor` access to the provided subscription. Visit [role-based-access-control](https://docs.microsoft.com/en-us/azure/role-based-access-control/role-assignments-portal?tabs=current#prerequisites) for more details.
11. In the `API permissions` blade, add the required `SharePoint` permissions. This can be either `Sites.FullControl.All` or `Sites.Manage.All` or `Sites.Selected` depending on the use case. 
12. Click on `Grant admin consent for <tenant name>` to grant admin consent for the application to access the resources in the tenant.

For a more detailed overview, see more guidance around [Azure Federated Credentials](https://docs.microsoft.com/en-us/azure/active-directory/develop/workload-identity-federation-create-trust-github). 

#### Option 2 - Microsoft Graph

1. Launch [Azure Cloud Shell](https://portal.azure.com/#cloudshell/) and sign in to your tenant.
1. Create a federated identity credential

    Run the following command to [create a new federated identity credential](https://docs.microsoft.com/en-us/graph/api/application-post-federatedidentitycredentials?view=graph-rest-beta&preserve-view=true) on your app (specified by the object ID of the app). Substitute the values `APPLICATION-OBJECT-ID`, `CREDENTIAL-NAME`, `SUBJECT`. The options for subject refer to your request filter. These are the conditions that OpenID Connect uses to determine when to issue an authentication token.  
    * specific environment
        ```azurecli
        az rest --method POST --uri 'https://graph.microsoft.com/beta/applications/<APPLICATION-OBJECT-ID>/federatedIdentityCredentials' --body '{"name":"<CREDENTIAL-NAME>","issuer":"https://token.actions.githubusercontent.com","subject":"repo:octo-org/octo-repo:environment:Production","description":"Testing","audiences":["api://AzureADTokenExchange"]}' 
        ```
    * pull_request events
       ```azurecli
        az rest --method POST --uri 'https://graph.microsoft.com/beta/applications/<APPLICATION-OBJECT-ID>/federatedIdentityCredentials' --body '{"name":"<CREDENTIAL-NAME>","issuer":"https://token.actions.githubusercontent.com","subject":"repo:octo-org/octo-repo:pull_request","description":"Testing","audiences":["api://AzureADTokenExchange"]}' 
        ```
    * specific branch
       ```azurecli
        az rest --method POST --uri 'https://graph.microsoft.com/beta/applications/<APPLICATION-OBJECT-ID>/federatedIdentityCredentials' --body '{"name":"<CREDENTIAL-NAME>","issuer":"https://token.actions.githubusercontent.com","subject":"repo:octo-org/octo-repo:ref:refs/heads/{Branch}","description":"Testing","audiences":["api://AzureADTokenExchange"]}' 
        ```
    * specific tag
       ```azurecli
        az rest --method POST --uri 'https://graph.microsoft.com/beta/applications/<APPLICATION-OBJECT-ID>/federatedIdentityCredentials' --body '{"name":"<CREDENTIAL-NAME>","issuer":"https://token.actions.githubusercontent.com","subject":"repo:octo-org/octo-repo:ref:refs/heads/{Tag}","description":"Testing","audiences":["api://AzureADTokenExchange"]}' 
        ```
