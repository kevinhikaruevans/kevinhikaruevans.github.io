---
title: Concept2 Logbook Data Safety
description: Major whoopsie in Concept2's logbook
date: 2024-01-22
tags: rowing fun computers security
---

Some time last month, I was wanting to sync my Concept2 erg logbook with my Google Fit data. Concept2's API is actually quite pleasant to work with and had the data that I was wanting to retrieve. However, I noticed that their endpoint could be scraped to retrieve very sensitive info on others. This seems like a major whoopsy. Concept2 responded quickly and addressed the problems, but I question whether or not my data is safe in Concept2's servers.

### Their API

To retrieve your user data, it's a simple `GET` call,

```bash
curl https://log.concept2.com/api/users/$USER_ID --header "Authorization: Bearer $API_KEY" | jq
```

This retrieves a lovely JSON-formatted response,

```json
{
  "data": {
    "id": 123456789,
    "username": "myusername",
    "first_name": "Kevin",
    "last_name": "Evans",
    "gender": "M",
    "dob": "1800-01-01",
    "email": "my-email@some-domain.com",
    "country": "USA",
    "profile_image": null,
    "age_restricted": false,
    "email_permission": false,
    "max_heart_rate": null,
    "weight": null,
    "roles": [],
    "logbook_privacy": "partners"
  }
}
```


I was curious to see what would result if I weren't authorized, so I ran

```bash
curl https://log.concept2.com/api/users/$((USER_ID+1)) --header "Authorization: Bearer $API_KEY" | jq
```

To my surprise, this gave me the same data fields for other users! I could retrieve the username, first and last names, gender, DOB, email, weight, max HR, and profile images of ANY user on Concept2, including children!

![screenshot showing profile data with sensitive information redacted](/assets/images/2024-01-24-term-screenshot.png)

### Report and response

After seeing this, I promptly emailed the Concept2 Logbook team, noting that this is a pretty serious issue. They responsed quickly with,

> Hi Keith,
 
> Thanks for bringing this to our attention. It should not be possible to return this level of information. It looks like a very recent change affected this by putting a bug into the permission logic. The API is set to return a small level of information about the user, no different from visiting their profile page. The bug has been fixed now and we will reconsider whether the information we return in still appropriate. I've quickly checked out logs, and it does not appear that anyone has taken advanatge of this bug, but I will check them in more detail.
 
> Thanks again for letting us know.
 
> Best,  

Well, first off, my name is Kevin and not Keith.

But I'm really wondering how the hell was this missed and how long was this vulnerability in place for? Were there no unit tests before deployments? I wonder how thoroughly they checked the logs to see if anybody has exploited this. 

Can I trust Concept2 to store my data in the future? (No.)
