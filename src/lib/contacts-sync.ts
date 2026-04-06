import { prisma } from "./prisma";
import { getGoogleAccessToken } from "./google-token";

interface ContactData {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  industry?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  city?: string | null;
  country?: string | null;
  message?: string | null;
  source?: string | null;
  isLead?: boolean;
  isNewsletter?: boolean;
}

/** Push a contact to Brevo */
export async function pushToBrevo(contact: ContactData) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return;

  const listIds: number[] = [];
  if (contact.isLead) listIds.push(5);
  if (contact.isNewsletter) listIds.push(6);
  if (listIds.length === 0) listIds.push(5);

  await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: contact.email,
      attributes: {
        FIRSTNAME: contact.firstName || "",
        LASTNAME: contact.lastName || "",
        COMPANY: contact.company || "",
        JOB_TITLE: contact.jobTitle || "",
        INDUSTRY: contact.industry || "",
        LINKEDIN: contact.linkedinUrl || "",
        COUNTRY: contact.country || "",
        CITY: contact.city || "",
        MESSAGE: contact.message || "",
      },
      listIds,
      updateEnabled: true,
    }),
  });
}

/** Push a contact to Google Contacts */
export async function pushToGoogle(contact: ContactData) {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return;

  // Search for existing contact by email
  const searchRes = await fetch(
    `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(contact.email)}&readMask=names,emailAddresses,organizations,phoneNumbers`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let resourceName: string | null = null;
  let etag: string | null = null;

  if (searchRes.ok) {
    const data = await searchRes.json();
    const match = data.results?.find((r: { person: { emailAddresses?: { value: string }[] } }) =>
      r.person?.emailAddresses?.some(
        (e: { value: string }) => e.value.toLowerCase() === contact.email.toLowerCase()
      )
    );
    if (match) {
      resourceName = match.person.resourceName;
      etag = match.person.etag;
    }
  }

  const personBody = {
    names: [
      {
        givenName: contact.firstName || "",
        familyName: contact.lastName || "",
      },
    ],
    emailAddresses: [{ value: contact.email }],
    organizations: [
      {
        name: contact.company || "",
        title: contact.jobTitle || "",
      },
    ],
    ...(contact.phone
      ? { phoneNumbers: [{ value: contact.phone }] }
      : {}),
  };

  if (resourceName) {
    // Update existing
    await fetch(
      `https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=names,emailAddresses,organizations,phoneNumbers`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...personBody, etag }),
      }
    );
  } else {
    // Create new
    await fetch("https://people.googleapis.com/v1/people:createContact", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(personBody),
    });
  }
}

